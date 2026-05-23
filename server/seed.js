const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const User = require('./models/User');
const Event = require('./models/Event');

const seed = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB');

        // --- Seed Admin User ---
        const adminEmail = 'admin@eventora.com';
        let admin = await User.findOne({ email: adminEmail });
        if (!admin) {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash('password123', salt);
            admin = await User.create({
                name: 'Eventora Admin',
                email: adminEmail,
                password: hashedPassword,
                role: 'admin',
                isVerified: true
            });
            console.log('✅ Admin user created:', adminEmail, '/ password123');
        } else {
            console.log('ℹ️  Admin user already exists, skipping.');
        }

        // --- Seed Test Event ---
        const testEventTitle = 'React India Conference 2025';
        let event = await Event.findOne({ title: testEventTitle });
        if (!event) {
            event = await Event.create({
                title: testEventTitle,
                description: 'Join the biggest React conference in India! Featuring world-class speakers, hands-on workshops, networking sessions, and the latest updates from the React ecosystem. A must-attend event for every frontend developer.',
                date: new Date('2027-09-15T10:00:00.000Z'),
                location: 'Bangalore International Convention Centre, Bangalore',
                category: 'technology',
                totalSeats: 200,
                availableSeats: 200,
                ticketPrice: 999,
                image: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1200&q=80',
                createdBy: admin._id
            });
            console.log('✅ Test event created:', testEventTitle, '@ ₹999');
        } else {
            console.log('ℹ️  Test event already exists, skipping.');
        }

        // --- Seed second free event ---
        const freeEventTitle = 'Eventora Community Meetup - Mumbai';
        let freeEvent = await Event.findOne({ title: freeEventTitle });
        if (!freeEvent) {
            freeEvent = await Event.create({
                title: freeEventTitle,
                description: 'A free community meetup for tech enthusiasts in Mumbai. Come and connect with fellow developers, listen to lightning talks, and enjoy food and networking. All skill levels welcome!',
                date: new Date('2027-08-20T18:00:00.000Z'),
                location: 'WeWork Bandra, Mumbai',
                category: 'community',
                totalSeats: 100,
                availableSeats: 100,
                ticketPrice: 0,
                image: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=1200&q=80',
                createdBy: admin._id
            });
            console.log('✅ Free community event created:', freeEventTitle);
        } else {
            console.log('ℹ️  Free event already exists, skipping.');
        }

        console.log('\n🎉 Seeding complete!');
        console.log('   Admin Login → admin@eventora.com / password123');
        process.exit(0);
    } catch (error) {
        console.error('❌ Seed error:', error.message);
        process.exit(1);
    }
};

seed();
