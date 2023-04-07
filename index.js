const express = require('express');
const cors = require('cors');
require('dotenv').config()
const { MongoClient, ServerApiVersion } = require('mongodb');
const  ObjectId = require('mongodb').ObjectId;
const app = express();
const port = process.env.PORT || 5000;

// middleware.....
app.use(cors());
app.use(express.json());

/**
 * working with mongodb database
*/
const uri = "mongodb+srv://my-mess1:40mgA58KnPNrBn3Y@cluster0.gvie0th.mongodb.net/?retryWrites=true&w=majority";
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run() {
    try {

        await client.connect();
        //database collections
        const userCollection = client.db('myMess1').collection('user');
        const messCollection = client.db('myMess1').collection('mess');
        const messMemberCollection = client.db('myMess1').collection('messMember');
        const requestedMemberCollectionn = client.db('myMess1').collection('requestedMember')

        // post or update user information from client to database
        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const userInfo = req.body;
            const filter = { email: email }
            const option = { upsert: true }
            const updateDoc = {
                $set: userInfo
            }
            const result = await userCollection.updateOne(filter, updateDoc, option);
            res.send(result);
        })

        // Create mess api. Save mess information to database
        app.post('/mess/:email', async (req, res) => {
            const email = req.params.email;
            const { messInfo, currentUser } = req.body;

            if (currentUser?.email === messInfo?.ownerEmail) {
                const query = { ownerEmail: email };
                const cursor = messCollection.find(query);
                existingMesses = await cursor.toArray();

                if (existingMesses.length === 0) {
                    const result = await messCollection.insertOne(messInfo);
                    res.send(result);
                }
                if (existingMesses.length > 0) {
                    const exist = existingMesses.find(mess => mess.ownerEmail === email);
                    if (!exist) {
                        const result = await messCollection.insertOne(messInfo);
                        res.send(result);
                    } else {
                        res.send({ message: 'You have already a mess' })
                    }
                }
            } else {
                res.send({ message: `Sorry! only you can create a mess ${messInfo.ownerEmail} isn't you.` })
            }
        })

        //get mess information from database to server.....
        app.get('/mess/:email', async (req, res) => {
            const email = req.params.email;
            const query = { ownerEmail: email };
            const cursor = messCollection.find(query);
            const allMess = await cursor.toArray();
            const existOwner = allMess.find(singleMess => singleMess.ownerEmail === email);
            if (existOwner) {
                const expectedMess = await messCollection.findOne(query);
                res.send(expectedMess);
            }else{
                res.send({message: 'Sorry! You have no mess. For access dashboard either you must have a mess or you have stay as mess member'})
            }

        })

        //get mess information by id
        app.get('/messById/:id', async(req, res) => {
            const id = req.params.id;
            const query = {_id:new ObjectId(id)};
            const expectedMess = await messCollection.findOne(query);
            res.send(expectedMess);
        })


        //post or update new mess member information to database
        app.put('/addMessMember/:email', async(req, res) => {
            const memberEmail = req.params.email;
            const memberInfo = req.body;
            const query = {};
            const cursor = userCollection.find(query);
            const allUser = await cursor.toArray();
            const isAccountAxist = allUser.find(user => user.userEmail === memberEmail);
            if(isAccountAxist){
                const filter = {emailAddress: memberEmail};
                const options = {upsert: true};
                const updateDoc = {
                    $set: memberInfo,
                };
                const result = await messMemberCollection.updateOne(filter, updateDoc, options);
                res.send(result);
            }else{
                res.send({message: `Opps! ${memberInfo.emailAddress} can't find. This member haven\'t an account on this website`});
            }
        })

        //get all current member from messMember collection..........
        app.get('/messMember', async(req, res) => {
            const query = {};
            const cursor = messMemberCollection.find(query);
            const result = await cursor.toArray();
            res.send(result);
        })

        // post or update member request
        app.put('/requestedMember/:email', async(req, res) => {
            const email = req.params.email;
            const requestedMemberInfo = req.body;
            const filter = {email: email};
            const options = {upsert: true};
            const updateDoc = {
                $set: requestedMemberInfo,
            }
            const result = await requestedMemberCollectionn.updateOne(filter, updateDoc,  options);
            res.send(result);
        })

        //get all requested member .....
        app.get('/requestedMember', async(req, res) => {
            const query = {};
            const cursor = requestedMemberCollectionn.find(query);
            const result = await cursor.toArray();
            res.send(result);
        })
        // delete indevisual requested member from database....
        app.delete('/requestedMember/:email', async(req, res) => {
            const email = req.params.email;
            const query = {email: email};
            const result = await requestedMemberCollectionn.deleteOne(query);
            res.send(result);
        })

        //delete indevisual mess member from database....
        app.delete('/messMember/:email', async(req, res) => {
            const email = req.params.email;
            const query = {emailAddress: email};
            const result = await messMemberCollection.deleteOne(query);
            res.send(result);
        })

    } finally {

    }
}
run().catch(console.dir);

// root api....
app.get('/', (req, res) => {
    res.send('Mess server is running');
})


app.listen(port, () => {
    console.log('server listing on port', port);
})