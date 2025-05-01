require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const userRoutes = require('./routes/user');
const apiRoutes = require('./routes/api'); // Added API routes for AJAX

const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true })); // For parsing form data
app.use(express.json()); // For parsing application/json

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, httpOnly: true, maxAge: 24 * 60 * 60 * 1000 } // Added httpOnly and maxAge
}));

// Middleware to make user info and flash messages available in all views
app.use((req, res, next) => {
    res.locals.currentUser = req.session.user;
    res.locals.message = req.session.message;
    res.locals.NODE_ENV = process.env.NODE_ENV; // Make env available if needed
    delete req.session.message; // Clear message after accessing it
    next();
});

// --- Routes ---
app.get('/', (req, res) => {
    if (req.session.user) {
        if (req.session.user.role === 'ADMIN') {
            res.redirect('/admin/dashboard');
        } else {
            res.redirect('/user/dashboard');
        }
    } else {
        res.redirect('/login');
    }
});

app.use('/', authRoutes);
app.use('/admin', adminRoutes);
app.use('/user', userRoutes);
app.use('/api', apiRoutes); // Use API routes

// --- 404 Handler ---
app.use((req, res, next) => {
    res.status(404).render('404'); // Render a 404 page
});

// --- Error Handling ---
// Make sure this is the last middleware
app.use((err, req, res, next) => {
    console.error("Global Error Handler:", err.stack);
    // Avoid sending stack trace in production
    const status = err.status || 500;
    const message = process.env.NODE_ENV === 'production' ? 'Something went wrong!' : err.message;
    res.status(status).render('error', { // Render an error page
        error: { status: status, message: message, stack: process.env.NODE_ENV !== 'production' ? null : err.stack }
    });
});


// --- Start Server ---
const server = app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

// --- Graceful Shutdown ---
const cleanup = async () => {
    console.log('Shutting down server...');
    server.close(async () => {
        console.log('Server closed.');
        try {
            await prisma();
            console.log('Prisma disconnected.');
            process.exit(0);
        } catch (e) {
            console.error('Error disconnecting Prisma:', e);
            process.exit(1);
        }
    });
};

process.on('SIGTERM', cleanup);
process.on('SIGINT', cleanup);

