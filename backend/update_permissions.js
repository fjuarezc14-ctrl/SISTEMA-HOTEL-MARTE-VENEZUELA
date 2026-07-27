import mongoose from 'mongoose';
mongoose.connect('mongodb://localhost:27017/hotel_marte').then(async () => {
    const db = mongoose.connection.db;
    const result = await db.collection('users').updateMany(
        { permisos: { $ne: 'tienda' } },
        { $addToSet: { permisos: 'tienda' } }
    );
    console.log(result);
    process.exit(0);
}).catch(console.error);
