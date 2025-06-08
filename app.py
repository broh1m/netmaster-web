from flask import Flask, render_template, request, redirect, url_for, jsonify, flash, send_from_directory
import ipaddress
import math
import re
import os
from datetime import datetime, timezone
import sqlite3
from flask_sqlalchemy import SQLAlchemy
import secrets
from sqlalchemy.exc import SQLAlchemyError, OperationalError, TimeoutError
from contextlib import contextmanager
import time
import json

app = Flask(__name__, static_folder='static')
# Use environment variable for secret key, fallback to generated key
app.secret_key = os.environ.get('FLASK_SECRET_KEY') or secrets.token_hex(32)

# Database configuration
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///notes.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
    'connect_args': {
        'timeout': 30  # SQLite connection timeout in seconds
    }
}

db = SQLAlchemy(app)

# Store calculation progress
calculation_progress = {}

# Database connection retry decorator
def with_db_retry(max_retries=3, delay=1):
    def decorator(func):
        def wrapper(*args, **kwargs):
            retries = 0
            while retries < max_retries:
                try:
                    return func(*args, **kwargs)
                except (OperationalError, sqlite3.OperationalError) as e:
                    retries += 1
                    if retries == max_retries:
                        app.logger.error(f"Database operation failed after {max_retries} retries: {str(e)}")
                        raise
                    time.sleep(delay)
            return None
        wrapper.__name__ = func.__name__
        return wrapper
    return decorator

# Transaction context manager
@contextmanager
def transaction():
    try:
        yield
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Transaction failed: {str(e)}")
        raise

def get_local_time():
    return datetime.now(timezone.utc)

class Note(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False, index=True)
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), default=get_local_time, index=True)
    updated_at = db.Column(db.DateTime(timezone=True), default=get_local_time, onupdate=get_local_time, index=True)

    def __repr__(self):
        return f'<Note {self.id}>'

# Create the database tables
with app.app_context():
    try:
        db.create_all()
    except SQLAlchemyError as e:
        app.logger.error(f"Failed to create database tables: {str(e)}")
        raise

def validate_ip_cidr(ip_cidr):
    try:
        # Check if input is None or empty
        if not ip_cidr or not isinstance(ip_cidr, str):
            return False, "IP/CIDR input is required"

        # Remove any whitespace
        ip_cidr = ip_cidr.strip()
        
        # Check if the format is correct using a more precise regex
        if not re.match(r'^(\d{1,3}\.){3}\d{1,3}/\d{1,2}$', ip_cidr):
            return False, "Invalid IP/CIDR format. Expected format: xxx.xxx.xxx.xxx/xx"
        
        # Split IP and CIDR
        ip, cidr = ip_cidr.split('/')
        cidr = int(cidr)
        
        # Validate CIDR range
        if not 1 <= cidr <= 32:
            return False, "CIDR must be between 1 and 32"
        
        # Validate IP octets
        octets = ip.split('.')
        if len(octets) != 4:
            return False, "Invalid IP address format. Must contain exactly 4 octets"
        
        # Check for leading zeros in octets
        for octet in octets:
            if len(octet) > 1 and octet.startswith('0'):
                return False, "IP octets cannot have leading zeros"
        
        # Validate octet values
        for octet in octets:
            try:
                value = int(octet)
                if not 0 <= value <= 255:
                    return False, f"IP octet {octet} must be between 0 and 255"
            except ValueError:
                return False, f"Invalid IP octet: {octet} is not a valid number"
        
        # Additional validation for network address
        try:
            network = ipaddress.ip_network(ip_cidr, strict=True)
            
            # Check if it's a valid network address (last octet should be 0)
            if network.network_address != ipaddress.ip_address(ip):
                return False, "IP address must be a valid network address (last octet should be 0)"
            
            # Check if the network is not too small for the CIDR
            if network.num_addresses < 2:
                return False, "Network is too small for the specified CIDR"
            
            # Check if the network is not too large
            if network.num_addresses > 16777216:  # /8 network
                return False, "Network is too large. Maximum allowed is a /8 network"
            
            # Check if it's not a reserved or special purpose address
            if network.is_private and not network.is_loopback and not network.is_link_local:
                return True, None
            elif network.is_loopback:
                return False, "Loopback addresses are not allowed"
            elif network.is_link_local:
                return False, "Link-local addresses are not allowed"
            elif network.is_multicast:
                return False, "Multicast addresses are not allowed"
            elif network.is_reserved:
                return False, "Reserved addresses are not allowed"
            elif network.is_unspecified:
                return False, "Unspecified addresses are not allowed"
            else:
                return False, "Only private network addresses are allowed"
                
        except ValueError as e:
            return False, f"Invalid network address: {str(e)}"
            
    except Exception as e:
        return False, f"Validation error: {str(e)}"

def calculate_subnet(task_id, network_ip, num_segments, vlan_start):
    try:
        network = ipaddress.ip_network(network_ip, strict=True)
        required_prefix = network.prefixlen + math.ceil(math.log2(num_segments))
        
        if required_prefix > 32:
            calculation_progress[task_id]['error'] = "Too many segments requested for the given network"
            return
        
        max_possible_subnets = 2 ** (32 - required_prefix)
        if max_possible_subnets < num_segments:
            calculation_progress[task_id]['error'] = f"Network {network_ip} can only support {max_possible_subnets} subnets with the required size"
            return
        
        subnet_generator = network.subnets(new_prefix=required_prefix)
        results = []
        
        for i in range(num_segments):
            try:
                subnet = next(subnet_generator)
                vlan_id = vlan_start + i
                
                if vlan_id > 4094:
                    calculation_progress[task_id]['error'] = "VLAN ID would exceed maximum value of 4094"
                    return
                
                network_address = subnet.network_address
                broadcast_address = subnet.broadcast_address
                usable_hosts = subnet.num_addresses - 2 if subnet.num_addresses > 2 else 0
                
                default_gateway = None
                if subnet.num_addresses > 2:
                    try:
                        hosts = list(subnet.hosts())
                        if hosts:
                            default_gateway = str(hosts[0])
                        else:
                            default_gateway = 'N/A'
                    except Exception:
                        default_gateway = 'N/A'
                
                result = {
                    'vlan_id': vlan_id,
                    'network_id': str(network_address),
                    'subnet_mask': str(subnet.netmask),
                    'broadcast': str(broadcast_address),
                    'default_gateway': default_gateway or 'N/A',
                    'usable_hosts': usable_hosts,
                    'first_usable': str(list(subnet.hosts())[0]) if usable_hosts > 0 else 'N/A',
                    'last_usable': str(list(subnet.hosts())[-1]) if usable_hosts > 0 else 'N/A'
                }
                
                results.append(result)
                progress = int((i + 1) / num_segments * 100)
                calculation_progress[task_id] = {
                    'progress': progress,
                    'results': results,
                    'error': None
                }
                
                # Add a small delay to visualize progress
                time.sleep(0.30)
                
            except StopIteration:
                calculation_progress[task_id]['error'] = f"Not enough subnets available. Maximum possible: {len(results)}"
                return
        
        calculation_progress[task_id]['progress'] = 100 # Ensure 100% on completion
        
    except Exception as e:
        app.logger.error(f"Error in calculate_subnet for task {task_id}: {str(e)}")
        calculation_progress[task_id]['error'] = f"An error occurred during calculation: {str(e)}"

@app.route('/calculate_subnets', methods=['POST'])
def calculate_subnets_route():
    network_ip = request.form.get('network_ip', '').strip()
    num_segments = int(request.form.get('num_segments', '1'))
    vlan_start = int(request.form.get('vlan_start', '1'))
    
    # Generate a unique task ID
    task_id = secrets.token_hex(16)
    
    # Initialize progress for this task ID
    calculation_progress[task_id] = {
        'progress': 0,
        'results': [],
        'error': None
    }
    
    # Start calculation in a separate thread
    import threading
    thread = threading.Thread(
        target=lambda: calculate_subnet(task_id, network_ip, num_segments, vlan_start)
    )
    thread.start()
    
    return jsonify({'status': 'started', 'task_id': task_id})

@app.route('/get_progress/<task_id>')
def get_progress(task_id):
    progress_data = calculation_progress.get(task_id, {
        'progress': 0,
        'results': [],
        'error': None
    })
    return jsonify(progress_data)

@app.route('/', methods=['GET', 'POST'])
def home():
    if request.method == 'POST':
        network_ip = request.form.get('network_ip', '').strip()
        num_segments = request.form.get('num_segments', '').strip()
        vlan_start = request.form.get('vlan_start', '1').strip()
        
        # Validate inputs before starting the async calculation
        is_valid, error_msg = validate_ip_cidr(network_ip)
        if not is_valid:
            flash(error_msg, 'error')
            return render_template('index.html', 
                                network_ip=network_ip, 
                                num_segments=num_segments, 
                                vlan_start=vlan_start)
        
        try:
            num_segments_int = int(num_segments)
            if not 1 <= num_segments_int <= 64:
                flash("Number of segments must be between 1 and 64", 'error')
                return render_template('index.html', 
                                    network_ip=network_ip, 
                                    num_segments=num_segments, 
                                    vlan_start=vlan_start)
        except ValueError:
            flash("Number of segments must be a valid integer", 'error')
            return render_template('index.html', 
                                network_ip=network_ip, 
                                num_segments=num_segments, 
                                vlan_start=vlan_start)
        
        try:
            vlan_start_int = int(vlan_start)
            if not 1 <= vlan_start_int <= 4094:
                flash("VLAN ID must be between 1 and 4094", 'error')
                return render_template('index.html', 
                                    network_ip=network_ip, 
                                    num_segments=num_segments, 
                                    vlan_start=vlan_start)
        except ValueError:
            flash("VLAN ID must be a valid integer", 'error')
            return render_template('index.html', 
                                network_ip=network_ip, 
                                num_segments=num_segments, 
                                vlan_start=vlan_start)
        
        # If validation passes, the client-side JavaScript will handle starting the calculation
        # No need to pass results here as they will be fetched via AJAX
        return render_template('index.html', 
                             network_ip=network_ip, 
                             num_segments=num_segments, 
                             vlan_start=vlan_start)
    
    return render_template('index.html', 
                         network_ip='', 
                         num_segments='', 
                         vlan_start='1')

@app.route('/notes')
@with_db_retry()
def notes():
    try:
        # Get page number from query parameters, default to 1
        page = request.args.get('page', 1, type=int)
        per_page = 10  # Number of notes per page
        
        # Query notes with pagination
        pagination = Note.query.order_by(Note.created_at.desc()).paginate(
            page=page, 
            per_page=per_page,
            error_out=False
        )
        
        notes = pagination.items
        
        return render_template('notes.html', 
                             notes=notes,
                             pagination=pagination)
    except Exception as e:
        app.logger.error(f"Error fetching notes: {str(e)}")
        flash('An error occurred while fetching notes', 'error')
        return redirect(url_for('home'))

@app.route('/notes/create', methods=['POST'])
@with_db_retry()
def create_note():
    try:
        title = request.form.get('title', '').strip()
        content = request.form.get('content', '').strip()
        
        if not title or not content:
            flash('Title and content are required', 'error')
            return redirect(url_for('notes'))
        
        with transaction():
            note = Note(title=title, content=content)
            db.session.add(note)
        
        flash('Note created successfully', 'success')
        return redirect(url_for('notes'))
    except Exception as e:
        app.logger.error(f"Error creating note: {str(e)}")
        flash('An error occurred while creating the note', 'error')
        return redirect(url_for('notes'))

@app.route('/notes/delete/<int:note_id>', methods=['POST'])
@with_db_retry()
def delete_note(note_id):
    try:
        with transaction():
            note = Note.query.get_or_404(note_id)
            db.session.delete(note)
        
        flash('Note deleted successfully', 'success')
        return redirect(url_for('notes'))
    except Exception as e:
        app.logger.error(f"Error deleting note: {str(e)}")
        flash('An error occurred while deleting the note', 'error')
        return redirect(url_for('notes'))

@app.route('/notes/edit/<int:note_id>', methods=['GET', 'POST'])
@with_db_retry()
def edit_note(note_id):
    try:
        note = Note.query.get_or_404(note_id)
        
        if request.method == 'POST':
            title = request.form.get('title', '').strip()
            content = request.form.get('content', '').strip()
            
            if not title or not content:
                flash('Title and content are required', 'error')
                return redirect(url_for('edit_note', note_id=note_id))
            
            with transaction():
                note.title = title
                note.content = content
            
            flash('Note updated successfully', 'success')
            return redirect(url_for('notes'))
        
        return render_template('edit_note.html', note=note)
    except Exception as e:
        app.logger.error(f"Error editing note: {str(e)}")
        flash('An error occurred while editing the note', 'error')
        return redirect(url_for('notes'))

if __name__ == '__main__':
    app.run(debug=True)
