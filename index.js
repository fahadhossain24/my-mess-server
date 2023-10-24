const express = require('express');
const cors = require('cors');
require('dotenv').config()
const { MongoClient, ServerApiVersion } = require('mongodb');
const { default: Stripe } = require('stripe');
const ObjectId = require('mongodb').ObjectId;
const app = express();
const port = process.env.PORT || 5000;
const stripe = require("stripe");
stripe.api_key = process.env.PAYMENT_SECRET_KEY;
const Sib = require('sib-api-v3-sdk');

const clientSib = Sib.ApiClient.instance
const apiKey = clientSib.authentications['api-key']
apiKey.apiKey = process.env.SENDINBLUE_SMTP_API_KEY


// middleware.....
app.use(cors());
// app.use(express.static("public"));
app.use(express.json());

/**
 * working with mongodb database
*/
const uri = `mongodb+srv://${process.env.DB_USER_NAME}:${process.env.DB_USER_PASSWORD}@cluster0.gvie0th.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });


app.get('/emni', (req, res) => {
    res.send('successfull')
})

async function run() {
    try {

        await client.connect();
        //database collections
        const userCollection = client.db('myMess1').collection('user');
        const messCollection = client.db('myMess1').collection('mess');
        const messMemberCollection = client.db('myMess1').collection('messMember');
        const requestedMemberCollectionn = client.db('myMess1').collection('requestedMember')


        // create intent and client secret for payment
        app.post("/createPaymentIntent", async (req, res) => {
            const price = req.body;
            const amount = price * 100
            // Create a PaymentIntent with the order amount and currency
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: "usd",
                payment_method_types: ['card'],
            });
            res.send({
                clientSecret: paymentIntent.client_secret,
            });
        });

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

        app.post('/messLocation', async(req, res) => {
            const messLocation = req.body;
            const query = {address: messLocation.locationName}
            const cursor = messCollection.find(query);
            const result = await cursor.toArray();
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
            } else {
                res.send({ message: 'Sorry! You have no mess. For access dashboard either you must have a mess or you must have membership to a mess' })
            }

        })

        //get mess information by id
        app.get('/messById/:id', async (req, res) => {
            const id = req.params.id;
            const query = {};
            const cursor = messCollection.find(query);
            const allMess = await cursor.toArray();
            const filteredId = allMess.find(mess => {
                const messId = mess._id.toString();
                const matchedMess = messId === id;
                return matchedMess;
            });
            // console.log(filteredId)
            if (filteredId) {
                const query = { _id: new ObjectId(id) };
                const expectedMess = await messCollection.findOne(query);
                res.send(expectedMess);
            } else {
                res.send({ message: 'Worng mess id!!!' });
            }

        })

        app.get('/messWithId/:id', async(req, res) => {
            const id = req.params.id;
            const query = {_id: new ObjectId(id)};
            const result = await messCollection.findOne(query);
            res.send(result);
        })


        //post or update new mess member information to database
        app.put('/addMessMember/:email', async (req, res) => {
            const memberEmail = req.params.email;
            const memberInfo = req.body;
            const query = {};
            const cursor = userCollection.find(query);
            const allUser = await cursor.toArray();
            const isAccountAxist = allUser.find(user => user.userEmail === memberEmail);
            if (isAccountAxist) {
                const filter = { emailAddress: memberEmail };
                const options = { upsert: true };
                const updateDoc = {
                    $set: memberInfo,
                };
                const result = await messMemberCollection.updateOne(filter, updateDoc, options);
                if (result.upsertedCount > 0) {
                    const tranEmailApi = new Sib.TransactionalEmailsApi()
                    const sender = {
                        email: 'fahadhossaim24@gmail.com',
                        name: 'Fahad Hossain',
                    }
                    const receivers = [
                        {
                            email: memberEmail,
                        },
                    ]
                    tranEmailApi
                        .sendTransacEmail({
                            sender,
                            to: receivers,
                            subject: 'Member activation success',
                            htmlContent: `
                            <h1><span style='color: cyan'>${memberInfo?.name}</span> Congratulations! You are successfully added</h1>
                            <h2>Your mess id: ${memberInfo?.messId}</h2>
                            <h3>You room catagory: ${memberInfo?.roomCatagory}</h3>
                            <p>As soon as possible your membership will be updated. Please wait for that and after you got a membership updated email then you will be login your profile.</p>
                            <br/>
                            <h2>Thank you</h2>
                            `,
                            params: {
                                role: 'Frontend',
                            },
                        })
                } else {
                    const tranEmailApi = new Sib.TransactionalEmailsApi()
                    const sender = {
                        email: 'fahadhossaim24@gmail.com',
                        name: 'Fahad Hossain',
                    }
                    const receivers = [
                        {
                            email: memberEmail,
                        },
                    ]
                    tranEmailApi
                        .sendTransacEmail({
                            sender,
                            to: receivers,
                            subject: 'Member Updating success',
                            htmlContent: `
                                <h1>Wow! <span style='color: cyan'>${memberInfo?.name}</span> you have gotten full membership</h1>
                                <h2>You are a ${memberInfo?.memberRole} of the mess</h2>
                                <h3>House Rant: ${memberInfo?.houseRant}</h3>
                                <h3>Others cost: ${memberInfo?.othersCost}</h3>
                                <h3>Developmentn Charge: ${memberInfo?.developmentCharge}</h3>
                                <h2>Now you are a actual member of this mess.</h2>
                                <h3>Enjoy your journy</h3>
                                <p>Best wishes from owner</p>
                                <h2>Thank you</h2>
                                `,
                            params: {
                                role: 'Frontend',
                            },
                        })
                }
                res.send(result);
            } else {
                res.send({ message: `Opps! ${memberInfo.emailAddress} can't find. This member haven\'t an account on this website` });
            }
        })

        //get all current mess member from messMember collection..........
        app.get('/messMember/:messId', async (req, res) => {
            console.log(req.params.messId)
            const messId = req.params.messId;
            const query = {messId: messId};
            const cursor = messMemberCollection.find(query);
            const result = await cursor.toArray();
            res.send(result);
        })

        //get specific current mess member by email from messMember collection..........
        app.get('/messMemberbyEmail/:email', async (req, res) => {
            const email = req.params.email;
            const query = {emailAddress: email};
            const getSpecificMember = await messMemberCollection.findOne(query);
            if(!getSpecificMember){
                res.send({
                    status: 'failed',
                    message: 'Could not find member'
                })
            }else{
                res.send(getSpecificMember);
            }
        })

        // post or update member request
        app.put('/requestedMember/:email', async (req, res) => {
            const email = req.params.email;
            const requestedMemberInfo = req.body;
            const filter = { email: email };
            const options = { upsert: true };
            const updateDoc = {
                $set: requestedMemberInfo,
            }
            const result = await requestedMemberCollectionn.updateOne(filter, updateDoc, options);
            res.send(result);
        })

        //get all requested member .....
        app.get('/requestedMember/:messId', async (req, res) => {
            const messId = req.params.messId;
            const query = {messId: messId};
            const cursor = requestedMemberCollectionn.find(query);
            const result = await cursor.toArray();
            res.send(result);
        })

        // get all mess information
        app.get('/allMessInfo/:currentUserEmail', async(req, res) => {
            const email = req.params.currentUserEmail;
            const query = {ownerEmail: email}
            const result = await messCollection.findOne(query);
            res.send(result);
        })

        // delete indevisual requested member from database....
        app.delete('/requestedMember/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const result = await requestedMemberCollectionn.deleteOne(query);
            res.send(result);
        })

        //delete indevisual mess member from database....
        app.delete('/messMember/:email', async (req, res) => {
            const email = req.params.email;
            const query = { emailAddress: email };
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