# NetMaster - IP Subnet Calculator

A secure Flask-based web application for calculating IP subnets with user authentication and note-taking capabilities.

## 🚀 Quick Start

### Prerequisites
- Python 3.8+
- pip (Python package installer)

### Installation

1. **Clone and navigate to the project:**
   ```bash
   cd ipsubnet-web
   ```

2. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Set up environment variables:**
   Create a `.env` file in the project root:
   ```bash
   FLASK_SECRET_KEY=your-very-secure-secret-key-here
   FLASK_ENV=development
   FLASK_DEBUG=True
   PORT=5000
   ```

4. **Initialize the database:**
   ```bash
   python3 init_db.py
   ```

5. **Run the application:**
   ```bash
   python3 app.py
   ```

6. **Access the application:**
   Open your browser and go to `http://localhost:5000`

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `FLASK_SECRET_KEY` | Secret key for session management | - | Yes |
| `FLASK_ENV` | Environment (development/production) | development | No |
| `FLASK_DEBUG` | Enable debug mode | False | No |
| `PORT` | Port to run the application | 5000 | No |

### Production Deployment

For production deployment, set these environment variables:
```bash
FLASK_ENV=production
FLASK_SECRET_KEY=your-very-secure-secret-key-here
FLASK_DEBUG=False
```

## 🛡️ Security Features

- ✅ Secure password hashing
- ✅ CSRF protection
- ✅ Rate limiting
- ✅ Input validation and sanitization
- ✅ Security headers (CSP, X-Frame-Options, etc.)
- ✅ SQL injection prevention
- ✅ XSS protection

## 📁 Project Structure

```
ipsubnet-web/
├── app.py                 # Main Flask application
├── init_db.py            # Database initialization script
├── requirements.txt      # Python dependencies
├── .env                  # Environment variables (create this)
├── static/              # Static files (CSS, JS, images)
├── templates/           # HTML templates
├── migrations/          # Database migrations
└── instance/           # Database files
```

## 🔍 Troubleshooting

### Database Issues
If you encounter database-related errors:
1. Delete the `instance/` directory
2. Run `python3 init_db.py` again
3. Restart the application

### Port Already in Use
If port 5000 is already in use:
1. Set a different port in your `.env` file: `PORT=8000`
2. Or kill the process using port 5000

### Import Errors
Make sure all dependencies are installed:
```bash
pip install -r requirements.txt
```

## 📝 Features

- **IP Subnet Calculation**: Calculate subnets based on host count or VLAN requirements
- **User Authentication**: Secure user registration and login
- **Note Management**: Save and manage calculation results
- **Responsive Design**: Works on desktop and mobile devices
- **Dark/Light Theme**: User preference-based theming
- **Data Export**: Export user data in JSON format

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.
