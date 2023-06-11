const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
    const authorization = req.headers.authorization;

    if (!authorization) {
        return res.status(401).send({ error: true, message: 'Unauthorized access...' });
    }

    const token = authorization.split(' ')[1];

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ error: true, message: 'Unauthorized access' });
        }

        req.decoded = decoded;
        next();
    })
}


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.fuichu5.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();

        const userCollection = client.db("sportyDB").collection("users");
        const classCollection = client.db("sportyDB").collection("classes");
        const cartCollection = client.db("sportyDB").collection("carts");

        // verify admin
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email };

            const user = await userCollection.findOne(query);

            if (user?.role !== 'admin') {
                return res.status(403).send({ error: true, message: 'forbidden message' });
            }

            next();
        }


        // verify instructor
        const verifyInstructor = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email };

            const user = await userCollection.findOne(query);

            if (user?.role !== 'instructor') {
                return res.status(403).send({ error: true, message: 'forbidden message' });
            }

            next();
        }


        // verify student
        const verifyStudent = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email };

            const user = await userCollection.findOne(query);

            if (user?.role !== 'student') {
                return res.status(403).send({ error: true, message: 'forbidden message' });
            }

            next();
        }


        // jwt issue api
        app.post('/jwt', (req, res) => {
            const user = req.body;

            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
            res.send({ token });
        });


        // users related apis
        app.get('/users', verifyJWT, verifyAdmin, async (req, res) => {
            const result = await userCollection.find().toArray();
            res.send(result);
        });


        app.get('/users/instructors', async (req, res) => {
            const query = { role: 'instructor' };

            const result = await userCollection.find(query).toArray();
            res.send(result);
        });


        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = { email: user.email };

            const existingUser = await userCollection.findOne(query);

            if (existingUser) {
                return res.send({ message: 'User Already Exists...' })
            }

            const result = await userCollection.insertOne(user);
            res.send(result);
        });


        app.patch('/users/:id', verifyJWT, verifyAdmin, async (req, res) => {
            const newRole = req.body.role;
            const id = req.params.id;

            const filter = { _id: new ObjectId(id) };

            const updateDoc = {
                $set: {
                    role: newRole
                }
            }

            const result = await userCollection.updateOne(filter, updateDoc);
            res.send(result);
        });


        // checks if the user is admin or not
        app.get('/users/admin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;

            if (req.decoded.email !== email) {
                return res.send({ admin: false });
            }

            const query = { email: email };
            const user = await userCollection.findOne(query);
            const result = { admin: user?.role === 'admin' };
            res.send(result);
        });


        // checks if the user is instructor or not
        app.get('/users/instructor/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;

            if (req.decoded.email !== email) {
                return res.send({ instructor: false });
            }

            const query = { email: email };
            const user = await userCollection.findOne(query);
            const result = { instructor: user?.role === 'instructor' };
            res.send(result);
        });


        // classes related apis
        app.get('/classes', verifyJWT, verifyAdmin, async (req, res) => {
            const result = await classCollection.find().toArray();
            res.send(result);
        });


        app.get('/classes/approved', async (req, res) => {
            const query = { status: 'approved' };

            const result = await classCollection.find(query).toArray();
            res.send(result);
        });


        app.get('/classes/:email', verifyJWT, verifyInstructor, async (req, res) => {
            const email = req.params.email;
            const query = { instructorEmail: email };

            const result = await classCollection.find(query).toArray();
            res.send(result);
        });


        app.post('/classes', verifyJWT, verifyInstructor, async (req, res) => {
            const newClass = req.body;

            const result = await classCollection.insertOne(newClass);
            res.send(result);
        });


        app.patch('/classes/status/:id', verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const newStatus = req.body.status;

            const filter = { _id: new ObjectId(id) };

            const updateDoc = {
                $set: {
                    status: newStatus
                }
            }

            const result = await classCollection.updateOne(filter, updateDoc);
            res.send(result);
        });


        app.patch('/classes/feedback/:id', verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const newFeedback = req.body.feedback;

            const filter = { _id: new ObjectId(id) };

            const updateDoc = {
                $set: {
                    feedback: newFeedback
                }
            }

            const result = await classCollection.updateOne(filter, updateDoc);
            res.send(result);
        });


        // cart related apis
        app.get('/carts', verifyJWT, verifyStudent, async (req, res) => {
            const email = req.query.email;

            if (!email) {
                return res.send([]);
            }

            const query = { studentEmail: email };

            const result = await cartCollection.find(query).toArray();
            res.send(result);
        });


        app.post('/carts', verifyJWT, verifyStudent, async (req, res) => {
            const selectedClass = req.body.selectedClass;
            const classId = selectedClass.classId;

            const query = { classId: classId };

            const existingClass = await cartCollection.findOne(query);

            if (existingClass && existingClass.studentEmail === selectedClass.studentEmail) {
                return res.send({ exist: true, message: 'class is already selected by the student...' });
            }

            const result = await cartCollection.insertOne(selectedClass);
            res.send(result);
        });


        app.delete('/carts/:id', verifyJWT, verifyStudent, async (req, res) => {
            const id = req.params.id;

            const query = { _id: new ObjectId(id) };

            const result = await cartCollection.deleteOne(query);
            res.send(result);
        });


        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('Sporty Smash Server is running....');
});

app.listen(port, () => {
    console.log(`Sporty Smash Server is running on Port: ${port}`);
});