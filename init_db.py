#!/usr/bin/env python3
"""
Database initialization script for NetMaster
Run this script to create the database tables and set up the initial schema.
"""

import os
import sys
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add the current directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import app, db

def init_database():
    """Initialize the database with all required tables"""
    with app.app_context():
        try:
            # Create all tables
            db.create_all()
            print("✅ Database tables created successfully!")
            
            # Verify tables exist
            tables = [table.name for table in db.metadata.tables.values()]
            print(f"📋 Created tables: {', '.join(tables)}")
            
            # Test database connection
            from sqlalchemy import text
            db.session.execute(text('SELECT 1'))
            print("✅ Database connection test successful!")
            
        except Exception as e:
            print(f"❌ Error initializing database: {e}")
            return False
    
    return True

if __name__ == '__main__':
    print("🚀 Initializing NetMaster database...")
    success = init_database()
    
    if success:
        print("\n🎉 Database initialization completed successfully!")
        print("You can now run the application with: python3 app.py")
    else:
        print("\n💥 Database initialization failed!")
        sys.exit(1)
