from flask import Flask, render_template, request, redirect, url_for, jsonify, flash, send_from_directory
import ipaddress
import math
import re
import os
from datetime import datetime, timezone
import sqlite3
from flask_sqlalchemy import SQLAlchemy

app = Flask(__name__, static_folder='static')
app.secret_key = 'your_secret_key'  # Needed for flashing messages
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///notes.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

def get_local_time():
    return datetime.now()

class Note(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=get_local_time)
    updated_at = db.Column(db.DateTime, default=get_local_time, onupdate=get_local_time)

# Create the database tables
with app.app_context():
    db.create_all()

def validate_ip_cidr(ip_cidr):
    try:
        # Check if the format is correct
        if not re.match(r'^(\d{1,3}\.){3}\d{1,3}/\d{1,2}$', ip_cidr):
            return False, "Invalid IP/CIDR format"
        
        # Split IP and CIDR
        ip, cidr = ip_cidr.split('/')
        cidr = int(cidr)
        
        # Validate CIDR range
        if not 1 <= cidr <= 32:
            return False, "CIDR must be between 1 and 32"
        
        # Validate IP octets
        octets = ip.split('.')
        if len(octets) != 4:
            return False, "Invalid IP address format"
        
        for octet in octets:
            if not 0 <= int(octet) <= 255:
                return False, "IP octets must be between 0 and 255"
        
        return True, None
    except Exception as e:
        return False, str(e)

@app.route('/', methods=['GET', 'POST'])
def home():
    results = []
    error = None
    network_ip = ''
    num_segments = ''
    vlan_start = '1'
    
    if request.method == 'POST':
        network_ip = request.form.get('network_ip', '')
        num_segments = request.form.get('num_segments', '')
        vlan_start = request.form.get('vlan_start', '1')
        
        try:
            # Validate inputs
            is_valid, error_msg = validate_ip_cidr(network_ip)
            if not is_valid:
                error = error_msg
                return render_template('index.html', network_ip=network_ip, 
                                    num_segments=num_segments, vlan_start=vlan_start,
                                    results=results, error=error)
            
            num_segments = int(num_segments)
            if not 1 <= num_segments <= 64:
                error = "Number of segments must be between 1 and 64"
                return render_template('index.html', network_ip=network_ip, 
                                    num_segments=num_segments, vlan_start=vlan_start,
                                    results=results, error=error)
            
            vlan_start = int(vlan_start)
            if not 1 <= vlan_start <= 4094:
                error = "VLAN ID must be between 1 and 4094"
                return render_template('index.html', network_ip=network_ip, 
                                    num_segments=num_segments, vlan_start=vlan_start,
                                    results=results, error=error)
            
            # Calculate subnets
            network = ipaddress.ip_network(network_ip, strict=False)
            required_prefix = network.prefixlen + math.ceil(math.log2(num_segments))
            
            if required_prefix > 32:
                error = "Too many segments requested for the given network"
                return render_template('index.html', network_ip=network_ip, 
                                    num_segments=num_segments, vlan_start=vlan_start,
                                    results=results, error=error)
            
            subnets = list(network.subnets(new_prefix=required_prefix))
            
            for i, subnet in enumerate(subnets[:num_segments]):
                vlan_id = vlan_start + i
                if vlan_id > 4094:
                    error = "VLAN ID would exceed maximum value of 4094"
                    break
                    
                results.append({
                    'vlan_id': vlan_id,
                    'network_id': str(subnet.network_address),
                    'subnet_mask': str(subnet.netmask),
                    'broadcast': str(subnet.broadcast_address),
                    'default_gateway': str(list(subnet.hosts())[0]) if subnet.num_addresses > 2 else 'N/A',
                    'usable_hosts': subnet.num_addresses - 2 if subnet.num_addresses > 2 else 0
                })
                
        except Exception as e:
            error = str(e)
            
    return render_template('index.html', network_ip=network_ip, 
                         num_segments=num_segments, vlan_start=vlan_start,
                         results=results, error=error)

@app.route('/notes')
def notes():
    all_notes = Note.query.order_by(Note.updated_at.desc()).all()
    return render_template('notes.html', notes=all_notes)

@app.route('/notes/create', methods=['POST'])
def create_note():
    title = request.form.get('title')
    content = request.form.get('content')
    
    if not title or not content:
        flash('Title and content are required', 'error')
        return redirect(url_for('notes'))
    
    new_note = Note(title=title, content=content)
    db.session.add(new_note)
    db.session.commit()
    
    flash('Note created successfully!', 'success')
    return redirect(url_for('notes'))

@app.route('/notes/delete/<int:note_id>', methods=['POST'])
def delete_note(note_id):
    note = Note.query.get_or_404(note_id)
    db.session.delete(note)
    db.session.commit()
    flash('Note deleted successfully!', 'success')
    return redirect(url_for('notes'))

@app.route('/notes/edit/<int:note_id>', methods=['GET', 'POST'])
def edit_note(note_id):
    note = Note.query.get_or_404(note_id)
    
    if request.method == 'POST':
        title = request.form.get('title')
        content = request.form.get('content')
        
        if not title or not content:
            flash('Title and content are required', 'error')
            return redirect(url_for('edit_note', note_id=note_id))
        
        note.title = title
        note.content = content
        note.updated_at = get_local_time()
        db.session.commit()
        
        flash('Note updated successfully!', 'success')
        return redirect(url_for('notes'))
    
    return render_template('edit_note.html', note=note)

if __name__ == '__main__':
    app.run(debug=True)
