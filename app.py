import os
import stripe
from flask import Flask, render_template, jsonify, request, redirect, url_for
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from flask_sqlalchemy import SQLAlchemy
from flask_mail import Mail, Message
from werkzeug.security import generate_password_hash, check_password_hash
import datetime
from functools import wraps
import dash
from dash import dcc, html
import plotly.graph_objects as go
from plotly.subplots import make_subplots

# Initialize Flask server
server = Flask(__name__)

# Configuration for JWT
server.config['JWT_SECRET_KEY'] = 'your_jwt_secret_key'  # Change this to a random secret key
server.config['JWT_ACCESS_TOKEN_EXPIRES'] = datetime.timedelta(hours=1)

# Configuration for SQLAlchemy
server.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///users.db'  # Change to PostgreSQL for production
server.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Configuration for Flask-Mail
server.config['MAIL_SERVER'] = 'smtp.example.com'
server.config['MAIL_PORT'] = 587
server.config['MAIL_USE_TLS'] = True
server.config['MAIL_USERNAME'] = 'your-email@example.com'
server.config['MAIL_PASSWORD'] = 'your-email-password'

jwt = JWTManager(server)
db = SQLAlchemy(server)
mail = Mail(server)

# Configure Stripe
server.config['STRIPE_PUBLIC_KEY'] = os.getenv('STRIPE_PUBLIC_KEY', 'your_public_key')
server.config['STRIPE_SECRET_KEY'] = os.getenv('STRIPE_SECRET_KEY', 'your_secret_key')
server.config['STRIPE_WEBHOOK_SECRET'] = os.getenv('STRIPE_WEBHOOK_SECRET', 'your_webhook_secret')

stripe.api_key = server.config['STRIPE_SECRET_KEY']

# Define User model
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(150), unique=True, nullable=False)
    password = db.Column(db.String(150), nullable=False)
    subscription_status = db.Column(db.String(50), nullable=False, default='Free')

# Create the database and tables
with server.app_context():
    db.create_all()

# Initialize Dash app
app = dash.Dash(__name__, server=server, url_base_pathname='/dash/')

# Create your IV curve figure
def create_figure():
    fig = make_subplots(specs=[[{"secondary_y": True}]])
    
    # Dummy data
    voltage = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45]
    current = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1]
    power = [v * i for v, i in zip(voltage, current)]
    
    fig.add_trace(
        go.Scatter(
            x=voltage,
            y=current,
            name="IV Curve",
            mode="lines",
            line_color="#78c2ad",
            showlegend=True
        ),
        secondary_y=False
    )
    
    fig.add_trace(
        go.Scatter(
            x=voltage,
            y=power,
            name="Power Curve",
            mode="lines",
            line_color="#f3969a",
            showlegend=True
        ),
        secondary_y=True
    )

    fig.update_xaxes(title_text="Voltage (V)")
    fig.update_yaxes(title_text="Current (A)", secondary_y=False)
    fig.update_yaxes(title_text="Power (W)", secondary_y=True)
    fig.update_layout(title="IV and Power Curve", hovermode="closest")

    return fig

# Define the layout of the Dash app
app.layout = html.Div([
    dcc.Graph(id='iv-curve', figure=create_figure())
])

# Define a route for the main page
@server.route('/')
def index():
    return render_template('index.html')

# User Registration Route
@server.route('/register', methods=['POST'])
def register():
    username = request.json.get('username', None)
    password = request.json.get('password', None)
    if not username or not password:
        return jsonify({"msg": "Missing username or password"}), 400

    if User.query.filter_by(username=username).first():
        return jsonify({"msg": "User already exists"}), 400

    new_user = User(username=username, password=generate_password_hash(password))
    db.session.add(new_user)
    db.session.commit()
    return jsonify({"msg": "User created"}), 201

# User Login Route
@server.route('/login', methods=['POST'])
def login():
    username = request.json.get('username', None)
    password = request.json.get('password', None)
    if not username or not password:
        return jsonify({"msg": "Missing username or password"}), 400

    user = User.query.filter_by(username=username).first()
    if not user or not check_password_hash(user.password, password):
        return jsonify({"msg": "Bad username or password"}), 401

    access_token = create_access_token(identity=username)
    return jsonify(access_token=access_token), 200

# Protected Route
@server.route('/protected', methods=['GET'])
@jwt_required()
def protected():
    current_user = get_jwt_identity()
    return jsonify(logged_in_as=current_user), 200

# Custom Token Required Decorator
def token_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        verify_jwt_in_request()
        current_user = get_jwt_identity()
        # Additional custom checks can be done here
        return f(current_user, *args, **kwargs)
    return decorated_function

# Custom Protected Route
@server.route('/custom_protected', methods=['GET'])
@token_required
def custom_protected(current_user):
    return jsonify(logged_in_as=current_user), 200

# Payment Route
@server.route('/create-checkout-session', methods=['POST'])
@jwt_required()
def create_checkout_session():
    data = request.get_json()
    try:
        session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[{
                'price_data': {
                    'currency': 'usd',
                    'product_data': {
                        'name': data['product_name'],
                    },
                    'unit_amount': data['amount'],
                },
                'quantity': 1,
            }],
            mode='payment',
            success_url=url_for('payment_success', _external=True) + '?session_id={CHECKOUT_SESSION_ID}',
            cancel_url=url_for('payment_cancel', _external=True),
        )
        return jsonify({'id': session.id})
    except Exception as e:
        return jsonify(error=str(e)), 403

# Payment success and cancel routes
@server.route('/payment-success')
def payment_success():
    return render_template('success.html')

@server.route('/payment-cancel')
def payment_cancel():
    return render_template('cancel.html')

# Checkout route
@server.route('/checkout')
def checkout():
    return render_template('checkout.html', STRIPE_PUBLIC_KEY=server.config['STRIPE_PUBLIC_KEY'])

# Stripe Webhook Route
@server.route('/stripe-webhook', methods=['POST'])
def stripe_webhook():
    payload = request.get_data(as_text=True)
    sig_header = request.headers.get('Stripe-Signature')
    event = None

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, server.config['STRIPE_WEBHOOK_SECRET']
        )
    except ValueError as e:
        # Invalid payload
        return jsonify(success=False), 400
    except stripe.error.SignatureVerificationError as e:
        # Invalid signature
        return jsonify(success=False), 400

    if event['type'] == 'invoice.payment_succeeded':
        invoice = event['data']['object']
        # Update user subscription status in the database

    return jsonify(success=True), 200

# Send Verification Email Route
@server.route('/send-verification-email', methods=['POST'])
def send_verification_email():
    email = request.json.get('email')
    token = create_access_token(identity=email)
    msg = Message('Verify your email', sender='your-email@example.com', recipients=[email])
    msg.body = f'Please click the link to verify your email: {url_for("verify_email", token=token, _external=True)}'
    mail.send(msg)
    return jsonify({"msg": "Verification email sent"}), 200

# Verify Email Route
@server.route('/verify-email/<token>')
def verify_email(token):
    try:
        email = get_jwt_identity(token)
    except:
        return jsonify({"msg": "Invalid or expired token"}), 400
    # Mark email as verified in the database
    return jsonify({"msg": "Email verified"}), 200

# Reset Password Request Route
@server.route('/reset-password', methods=['POST'])
def reset_password():
    email = request.json.get('email')
    token = create_access_token(identity=email)
    msg = Message('Reset your password', sender='your-email@example.com', recipients=[email])
    msg.body = f'Please click the link to reset your password: {url_for("reset_password_token", token=token, _external=True)}'
    mail.send(msg)
    return jsonify({"msg": "Password reset email sent"}), 200

# Reset Password Route
@server.route('/reset-password/<token>', methods=['POST'])
def reset_password_token(token):
    try:
        email = get_jwt_identity(token)
    except:
        return jsonify({"msg": "Invalid or expired token"}), 400
    new_password = request.json.get('new_password')
    user = User.query.filter_by(email=email).first()
    user.password = generate_password_hash(new_password)
    db.session.commit()
    return jsonify({"msg": "Password reset successfully"}), 200

# User Dashboard Route
@server.route('/dashboard')
@jwt_required()
def dashboard():
    current_user = get_jwt_identity()
    user = User.query.filter_by(username=current_user).first()
    return render_template('dashboard.html', user=user)

if __name__ == '__main__':
    server.run(debug=False, port=8053)
