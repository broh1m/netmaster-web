from flask import Flask, render_template, request, redirect, url_for, jsonify, flash, send_from_directory, session
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
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user
from flask_wtf.csrf import CSRFProtect, CSRFError
from werkzeug.security import generate_password_hash, check_password_hash
import bleach
from functools import wraps
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

# Custom exceptions for subnet calculation
class SubnetCalculationError(Exception):
    """Base exception for subnet calculation errors"""
    pass

class NetworkValidationError(SubnetCalculationError):
    """Raised when network validation fails"""
    pass

class SegmentCountError(SubnetCalculationError):
    """Raised when segment count is invalid"""
    pass

class VLANRangeError(SubnetCalculationError):
    """Raised when VLAN ID is out of range"""
    pass

class NetworkSizeError(SubnetCalculationError):
    """Raised when network size is invalid"""
    pass

app = Flask(__name__, static_folder='static')
# Use environment variable for secret key, fallback to generated key
app.secret_key = os.environ.get('FLASK_SECRET_KEY') or secrets.token_hex(32)

# Add escapejs filter
@app.template_filter('escapejs')
def escapejs_filter(s):
    if s is None:
        return ''
    return str(s).replace('\\', '\\\\').replace("'", "\\'").replace('"', '\\"').replace('\n', '\\n')

# Security configurations
app.config['SESSION_COOKIE_SECURE'] = True
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['PERMANENT_SESSION_LIFETIME'] = 3600  # 1 hour
app.config['WTF_CSRF_ENABLED'] = True
app.config['WTF_CSRF_TIME_LIMIT'] = 3600  # 1 hour

# Initialize security extensions
csrf = CSRFProtect(app)
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'
login_manager.login_message = 'Please log in to access this page.'

# Initialize rate limiter
limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=["200 per day", "50 per hour"]
)

# Database configuration
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///notes.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
    'connect_args': {
        'timeout': 30  # SQLite connection timeout in seconds
    }
}

db = SQLAlchemy(app)

# Create database tables
with app.app_context():
    db.create_all()

# Store calculation progress
calculation_progress = {}

# Database connection retry decorator with enhanced error handling
def with_db_retry(max_retries=3, delay=1):
    def decorator(func):
        def wrapper(*args, **kwargs):
            retries = 0
            last_error = None
            while retries < max_retries:
                try:
                    return func(*args, **kwargs)
                except (OperationalError, sqlite3.OperationalError, TimeoutError) as e:
                    last_error = e
                    retries += 1
                    if retries == max_retries:
                        app.logger.error(f"Database operation failed after {max_retries} retries: {str(e)}")
                        raise
                    time.sleep(delay * retries)  # Exponential backoff
                except SQLAlchemyError as e:
                    app.logger.error(f"SQLAlchemy error: {str(e)}")
                    raise
            return None
        wrapper.__name__ = func.__name__
        return wrapper
    return decorator

# Enhanced transaction context manager
@contextmanager
def transaction():
    """Enhanced transaction context manager with timeout and error handling"""
    try:
        # Set statement timeout for this transaction
        db.session.execute('PRAGMA busy_timeout = 30000')  # 30 seconds timeout
        yield
        db.session.commit()
    except SQLAlchemyError as e:
        db.session.rollback()
        app.logger.error(f"Transaction failed: {str(e)}")
        raise
    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Unexpected error in transaction: {str(e)}")
        raise
    finally:
        # Ensure session is properly closed
        db.session.close()

# Database health check function
def check_db_health():
    """Check database connection health"""
    try:
        # Try to execute a simple query
        db.session.execute('SELECT 1')
        return True
    except Exception as e:
        app.logger.error(f"Database health check failed: {str(e)}")
        return False

# Database connection manager
class DatabaseConnectionManager:
    """Manages database connections and provides connection health monitoring"""
    
    @staticmethod
    def get_connection():
        """Get a database connection with health check"""
        if not check_db_health():
            raise SQLAlchemyError("Database connection is not healthy")
        return db.session

    @staticmethod
    def close_connection():
        """Close the database connection"""
        db.session.close()

    @staticmethod
    def execute_with_timeout(query, timeout=30):
        """Execute a query with a timeout"""
        try:
            db.session.execute('PRAGMA busy_timeout = ?', (timeout * 1000,))
            return db.session.execute(query)
        except Exception as e:
            app.logger.error(f"Query execution failed: {str(e)}")
            raise

def get_local_time():
    """Returns the current time in UTC.
    Note: We store all times in UTC in the database, and convert to local time in the templates."""
    return datetime.now(timezone.utc)

class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(128))
    notes = db.relationship('Note', backref='author', lazy=True)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

class Note(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False, index=True)
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), default=get_local_time, index=True)
    updated_at = db.Column(db.DateTime(timezone=True), default=get_local_time, onupdate=get_local_time, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)

    def __repr__(self):
        return f'<Note {self.id}>'

    @classmethod
    def get_by_id(cls, note_id):
        """Get a note by ID"""
        return db.session.get(cls, note_id)

    @classmethod
    def get_all_paginated(cls, page, per_page, user_id):
        """Get paginated notes for a specific user"""
        return cls.query.filter_by(user_id=user_id).order_by(cls.created_at.desc()).paginate(
            page=page, 
            per_page=per_page,
            error_out=False
        )

    def save(self):
        """Save the note"""
        db.session.add(self)
        db.session.commit()
        return self

    def delete(self):
        """Delete the note"""
        db.session.delete(self)
        db.session.commit()

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

def sanitize_input(text):
    """Sanitize user input to prevent XSS attacks"""
    if not text:
        return text
    # Remove HTML tags and encode special characters
    return bleach.clean(text, strip=True)

@app.route('/login', methods=['GET', 'POST'])
@limiter.limit("5 per minute")
def login():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        user = User.query.filter_by(username=username).first()
        
        if user and user.check_password(password):
            login_user(user)
            return redirect(url_for('notes'))
        flash('Invalid username or password', 'error')
    return render_template('login.html')

@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('login'))

@app.route('/register', methods=['GET', 'POST'])
@limiter.limit("3 per hour")
def register():
    if request.method == 'POST':
        try:
            username = sanitize_input(request.form.get('username', '').strip())
            email = sanitize_input(request.form.get('email', '').strip())
            password = request.form.get('password', '').strip()
            
            # Validate username
            if not username or len(username) < 3 or len(username) > 80:
                flash('Username must be between 3 and 80 characters long', 'error')
                return redirect(url_for('register'))
            
            # Validate email
            if not email or '@' not in email or '.' not in email:
                flash('Please enter a valid email address', 'error')
                return redirect(url_for('register'))
            
            # Validate password
            if not password or len(password) < 8:
                flash('Password must be at least 8 characters long', 'error')
                return redirect(url_for('register'))
            
            # Check if username exists
            if User.query.filter_by(username=username).first():
                flash('Username already exists', 'error')
                return redirect(url_for('register'))
            
            # Check if email exists
            if User.query.filter_by(email=email).first():
                flash('Email already registered', 'error')
                return redirect(url_for('register'))
            
            # Create new user
            user = User(username=username, email=email)
            user.set_password(password)
            
            try:
                db.session.add(user)
                db.session.commit()
                login_user(user)
                flash('Registration successful! Welcome to Subnet Calculator.', 'success')
                return redirect(url_for('home'))
            except SQLAlchemyError as e:
                db.session.rollback()
                app.logger.error(f"Database error during registration: {str(e)}")
                flash('An error occurred during registration. Please try again.', 'error')
                return redirect(url_for('register'))
                
        except Exception as e:
            app.logger.error(f"Unexpected error during registration: {str(e)}")
            flash('An unexpected error occurred. Please try again.', 'error')
            return redirect(url_for('register'))
            
    return render_template('register.html')

@app.route('/notes')
@login_required
# @limiter.limit("30 per minute")  # Temporarily commented out for debugging
def notes():
    try:
        page = request.args.get('page', 1, type=int)
        per_page = 10
        pagination = Note.get_all_paginated(page, per_page, current_user.id)
        notes = pagination.items
        return render_template('notes.html', notes=notes, pagination=pagination)
    except Exception as e:
        app.logger.error(f"Error fetching notes: {str(e)}")
        flash('An error occurred while fetching notes', 'error')
        return render_template('notes.html', notes=[], pagination=None)

@app.route('/notes/create', methods=['POST'])
@login_required
@limiter.limit("10 per minute")
def create_note():
    try:
        title = sanitize_input(request.form.get('title', '').strip())
        content = sanitize_input(request.form.get('content', '').strip())
        
        if not title or not content:
            flash('Title and content are required', 'error')
            return redirect(url_for('notes'))
        
        note = Note(title=title, content=content, user_id=current_user.id)
        note.save()
        
        flash('Note created successfully', 'success')
        return redirect(url_for('notes'))
    except Exception as e:
        app.logger.error(f"Error creating note: {str(e)}")
        flash('An error occurred while creating the note', 'error')
        return redirect(url_for('notes'))

@app.route('/notes/delete/<int:note_id>', methods=['POST'])
@login_required
# @limiter.limit("10 per minute") # Temporarily commented out for debugging
def delete_note(note_id):
    try:
        app.logger.info(f"Delete note attempt - Note ID: {note_id}, Current User ID: {current_user.id}")
        note = Note.get_by_id(note_id)
        
        if not note:
            app.logger.warning(f"Note not found - Note ID: {note_id}")
            flash('Note not found', 'error')
            return redirect(url_for('notes'))
            
        if note.user_id != current_user.id:
            app.logger.warning(f"Access denied - Note user_id: {note.user_id}, Current user_id: {current_user.id}")
            flash('Access denied', 'error')
            return redirect(url_for('notes'))
        
        note.delete()
        app.logger.info(f"Note deleted successfully - Note ID: {note_id}")
        flash('Note deleted successfully', 'success')
        return redirect(url_for('notes'))
        
    except Exception as e:
        app.logger.error(f"Error deleting note: {str(e)}", exc_info=True)
        flash('An error occurred while deleting the note', 'error')
        return redirect(url_for('notes'))

@app.route('/notes/edit/<int:note_id>', methods=['GET', 'POST'])
@login_required
@limiter.limit("10 per minute")
def edit_note(note_id):
    try:
        app.logger.info(f"Edit note attempt - Note ID: {note_id}, Current User ID: {current_user.id if current_user.is_authenticated else 'Not authenticated'}")
        note = Note.get_by_id(note_id)
        app.logger.info(f"Note found: {note is not None}")
        if not note or note.user_id != current_user.id:
            app.logger.warning(f"Access denied - Note user_id: {note.user_id if note else 'Note not found'}, Current user_id: {current_user.id}")
            flash('Note not found or access denied', 'error')
            return redirect(url_for('notes'))
        
        if request.method == 'POST':
            title = sanitize_input(request.form.get('title', '').strip())
            content = sanitize_input(request.form.get('content', '').strip())
            
            if not title or not content:
                flash('Title and content are required', 'error')
                return redirect(url_for('edit_note', note_id=note_id))
            
            note.title = title
            note.content = content
            note.save()
            
            flash('Note updated successfully', 'success')
            return redirect(url_for('notes'))
        
        return render_template('edit_note.html', note=note)
    except Exception as e:
        app.logger.error(f"Error editing note: {str(e)}", exc_info=True)
        flash('An error occurred while editing the note', 'error')
        return redirect(url_for('notes'))

@app.route('/calculate_subnets', methods=['POST'])
def calculate_subnets_route():
    try:
        if request.is_json:
            data = request.get_json()
            network_ip = data.get('network_ip', '').strip()
            vlan_mode = data.get('vlan_mode', False)
        else:
            network_ip = request.form.get('network_ip', '').strip()
            vlan_mode = False

        if not network_ip:
            raise NetworkValidationError("Network IP is required")

        # VLAN mode
        if vlan_mode:
            vlans = data.get('vlans', [])
            if not vlans or not isinstance(vlans, list):
                raise SegmentCountError("VLAN details are required")
            num_segments = len(vlans)
            vlan_ids = [int(v['vlan_id']) for v in vlans]
            vlan_names = [v['vlan_name'] for v in vlans]
            # Generate a unique task ID
            task_id = secrets.token_hex(16)
            calculation_progress[task_id] = {
                'progress': 0,
                'results': [],
                'error': None
            }
            import threading
            thread = threading.Thread(
                target=lambda: calculate_vlan_subnet(task_id, network_ip, vlans)
            )
            thread.start()
            return jsonify({'status': 'started', 'task_id': task_id})
        else:
            # Host-based mode
            try:
                num_hosts = int(data.get('num_hosts', '1'))
                if not 1 <= num_hosts <= 4094:
                    raise SegmentCountError("Number of hosts must be between 1 and 4094")
            except ValueError:
                raise SegmentCountError("Number of hosts must be a valid integer")
            # Generate a unique task ID
            task_id = secrets.token_hex(16)
            calculation_progress[task_id] = {
                'progress': 0,
                'results': [],
                'error': None
            }
            import threading
            thread = threading.Thread(
                target=lambda: calculate_host_subnet(task_id, network_ip, num_hosts)
            )
            thread.start()
            return jsonify({'status': 'started', 'task_id': task_id})
    except SubnetCalculationError as e:
        app.logger.error(f"Subnet calculation error: {str(e)}")
        return jsonify({'status': 'error', 'message': str(e)}), 400
    except Exception as e:
        app.logger.error(f"Unexpected error in calculate_subnets_route: {str(e)}")
        return jsonify({'status': 'error', 'message': f"An unexpected server error occurred: {str(e)}"}), 500

@app.route('/get_progress/<task_id>')
def get_progress(task_id):
    progress_data = calculation_progress.get(task_id, {
        'progress': 0,
        'results': [],
        'error': None
    })
    return jsonify(progress_data)

@app.route('/landing')
def landing():
    return render_template('landing.html')

@app.route('/')
def root():
    return redirect(url_for('landing'))

@app.route('/calculator', methods=['GET'])
def home():
    return render_template('index.html', 
                         network_ip='', 
                         num_segments='', 
                         vlan_start='1')

@app.errorhandler(CSRFError)
def handle_csrf_error(e):
    """Handle CSRF errors by returning a JSON response."""
    app.logger.error(f"CSRF error: {e.description}")
    return jsonify({'status': 'error', 'message': 'CSRF token missing or incorrect.'}), 400

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

def calculate_vlan_subnet(task_id, network_ip, vlans):
    try:
        is_valid, error_msg = validate_ip_cidr(network_ip)
        if not is_valid:
            raise NetworkValidationError(error_msg)
        network = ipaddress.ip_network(network_ip, strict=True)
        num_segments = len(vlans)
        required_prefix = network.prefixlen + math.ceil(math.log2(num_segments))
        if required_prefix > 32:
            raise NetworkSizeError("Too many VLANs requested for the given network")
        subnet_generator = network.subnets(new_prefix=required_prefix)
        results = []
        for i, vlan in enumerate(vlans):
            try:
                subnet = next(subnet_generator)
                vlan_id = int(vlan['vlan_id'])
                vlan_name = vlan['vlan_name']
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
                    'vlan_name': vlan_name,
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
                time.sleep(0.15)
            except StopIteration:
                raise NetworkSizeError(f"Not enough subnets available. Maximum possible: {len(results)}")
        calculation_progress[task_id]['progress'] = 100
    except SubnetCalculationError as e:
        app.logger.error(f"Subnet calculation error for task {task_id}: {str(e)}")
        calculation_progress[task_id]['error'] = str(e)
    except Exception as e:
        app.logger.error(f"Unexpected error in calculate_vlan_subnet for task {task_id}: {str(e)}")
        calculation_progress[task_id]['error'] = "An unexpected error occurred during calculation. Please try again."

def calculate_host_subnet(task_id, network_ip, num_hosts):
    try:
        is_valid, error_msg = validate_ip_cidr(network_ip)
        if not is_valid:
            raise NetworkValidationError(error_msg)
        network = ipaddress.ip_network(network_ip, strict=True)
        # Find the smallest prefix that can fit the number of hosts
        needed = num_hosts + 2  # network + broadcast
        prefix = 32
        for p in range(network.prefixlen, 33):
            if 2 ** (32 - p) >= needed:
                prefix = p
                break
        subnet_generator = network.subnets(new_prefix=prefix)
        results = []
        for i, subnet in enumerate(subnet_generator):
            usable_hosts = subnet.num_addresses - 2 if subnet.num_addresses > 2 else 0
            if usable_hosts < num_hosts:
                continue
            network_address = subnet.network_address
            broadcast_address = subnet.broadcast_address
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
                'network_id': str(network_address),
                'subnet_mask': str(subnet.netmask),
                'broadcast': str(broadcast_address),
                'default_gateway': default_gateway or 'N/A',
                'usable_hosts': usable_hosts,
                'first_usable': str(list(subnet.hosts())[0]) if usable_hosts > 0 else 'N/A',
                'last_usable': str(list(subnet.hosts())[-1]) if usable_hosts > 0 else 'N/A'
            }
            results.append(result)
            calculation_progress[task_id] = {
                'progress': 100,
                'results': results,
                'error': None
            }
            break  # Only need one subnet for the required hosts
    except SubnetCalculationError as e:
        app.logger.error(f"Subnet calculation error for task {task_id}: {str(e)}")
        calculation_progress[task_id]['error'] = str(e)
    except Exception as e:
        app.logger.error(f"Unexpected error in calculate_host_subnet for task {task_id}: {str(e)}")
        calculation_progress[task_id]['error'] = "An unexpected error occurred during calculation. Please try again."

# Catch-all error handler to ensure JSON responses for all exceptions
@app.errorhandler(Exception)
def handle_uncaught_exception(e):
    app.logger.error(f"An unhandled server error occurred: {e}", exc_info=True)
    message = 'An unexpected server error occurred. Please try again later.'
    if app.debug:
        message = f"An unexpected server error occurred: {str(e)}"
    response = jsonify({'status': 'error', 'message': message})
    response.status_code = 500
    return response

@app.route('/debug/notes')
def debug_notes():
    notes = Note.query.all()
    return jsonify([{
        'id': note.id,
        'title': note.title,
        'user_id': note.user_id,
        'created_at': note.created_at.isoformat(),
        'updated_at': note.updated_at.isoformat()
    } for note in notes])

@app.route('/notes/from_calculator', methods=['POST'])
@login_required
def add_note_from_calculator():
    if not request.is_json:
        return jsonify({'status': 'error', 'message': 'Invalid request format.'}), 400
    data = request.get_json()
    title = sanitize_input(data.get('title', '').strip())
    content = sanitize_input(data.get('content', '').strip())
    if not title or not content:
        return jsonify({'status': 'error', 'message': 'Title and content are required.'}), 400
    try:
        note = Note(title=title, content=content, user_id=current_user.id)
        note.save()
        return jsonify({'status': 'success', 'message': 'Note created successfully.'})
    except Exception as e:
        app.logger.error(f"Error creating note from calculator: {str(e)}")
        return jsonify({'status': 'error', 'message': 'Failed to create note.'}), 500

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True)
