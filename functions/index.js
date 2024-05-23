const functions = require("firebase-functions");
const admin = require("firebase-admin");
const nodemailer = require('nodemailer');


require('dotenv').config();
const stripe_key = process.env.STRIPE_SECRET_KEY 
const stripe = require("stripe")(stripe_key);

const authToken = process.env.TWILIO_AUTH_TOKEN
const accountSid = process.env.ACCOUNT_SID
const client = require('twilio')(accountSid, authToken);

var serviceAccount = require("./serviceAccountKey.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://beachbrosshare-default-rtdb.firebaseio.com"
});
const express = require("express")
const cors = require("cors")
const db = admin.firestore();

//main app r
const app = express()
app.use(cors({origin:true}))

// add product to the cart
app.post('/beachbrossapi/add-to-cart',  (req, res) => {
  (async () => {
    
      const { productId, userId } = req.body;
      // const response = await addItemToCart(productId, 1)
      const response = await getDocument(productId, userId)
      if(response){
        // const cart = await db.collection("Cart").doc(req.body.userId).get()
          return res.status(200).send({response})
      }else{
        return res.status(404).send({status:"error", message:"Product not found", response})
      }
      })()

})

 async function addItemToCart(productRef, productData, userId) {

  // Get the current user's cart reference
  const cartRef = db.collection('cart').doc(userId);

  try{

    return db.runTransaction(async transaction => {
      // Create an object for the cart item
      const cartDoc = await transaction.get(cartRef);
      const { price, productName, productId, imageUrl} = productData;
  
      const cartItem = {
        cartTotal: price,
        stripeObject: {
          productId: productRef,
            price_data: {
                currency: 'usd',
                unit_amount: price,
                product_data: {
                  name: productName,
                  description: 'best package curated just for you, perfect for your holiday. ',
                  images: [imageUrl],
                },           
              },
              adjustable_quantity: {
                enabled: true,
                minimum: 1,
                maximum: 10,
              },
        quantity: 1,
    
        },
        };
  
      // Check if the cart exists, otherwise create a new one
      if (!cartDoc.exists) {
        await transaction.set(cartRef, { Total: cartItem.cartTotal, items: [cartItem.stripeObject] });
      } else{
      // Get the existing cart items (or create an empty array)
      const existingCart = cartDoc.data();
      const existingItems = existingCart.items;
      // Check if the product already exists in the cart
      const existingItemIndex = existingItems.findIndex(item => item.productId.id === productId);
  
      if (existingItemIndex !== -1) {
        // Update the quantity for the existing item
        // existingItems[existingItemIndex].quantity += cartItem.stripeObject.quantity;
        // existingCart.Total = parseInt(existingCart.Total) + parseInt(existingItems[existingItemIndex].price_data.unit_amount);
        return {status: 'exist', message: 'Item already in cart'};

      } else {
        // Add the new cart item
        existingCart.Total = parseInt(cartItem.cartTotal) + parseInt(existingCart.Total); 
        existingItems.push(cartItem.stripeObject);
      }
      // Update the cart with the modified items
      await transaction.update(cartRef, { items: existingItems, Total: existingCart.Total });
      }
      return {status:'success', message: 'Product added to cart'};
  });
  }catch(error){
    throw error;
  }
  // Perform a transaction to ensure data consistency
}

// create user order
async function createUserOrder(productRef, productData, userId) {

  // Get the current user's cart reference
  const cartRef = db.collection('cart').doc(userId);
  try{
    return db.runTransaction(async transaction => {
      // Create an object for the cart item
      const cartDoc = await transaction.get(cartRef);
      const { price, productName, productId, imageUrl} = productData;
  
      const cartItem = {
        cartTotal: price,
        stripeObject: {
          productId: productRef,
            price_data: {
                currency: 'usd',
                unit_amount: price,
                product_data: {
                  name: productName,
                  description: 'best package curated just for you, perfect for your holiday. ',
                  images: [imageUrl],
                },           
              },
              adjustable_quantity: {
                enabled: true,
                minimum: 1,
                maximum: 10,
              },
        quantity: 1,
    
        },
        };
  
      // Check if the cart exists, otherwise create a new one
      if (!cartDoc.exists) {
        await transaction.set(cartRef, { Total: cartItem.cartTotal, items: [cartItem.stripeObject] });
      } else{
      // Get the existing cart items (or create an empty array)
      const existingCart = cartDoc.data();
      const existingItems = existingCart.items;
      // Check if the product already exists in the cart
      const existingItemIndex = existingItems.findIndex(item => item.productId.id === productId);
  
      if (existingItemIndex !== -1) {
        // Update the quantity for the existing item
        // existingItems[existingItemIndex].quantity += cartItem.stripeObject.quantity;
        // existingCart.Total = parseInt(existingCart.Total) + parseInt(existingItems[existingItemIndex].price_data.unit_amount);
        return {status: 'exist', message: 'Item already in cart'};

      } else {
        // Add the new cart item
        existingCart.Total = parseInt(cartItem.cartTotal) + parseInt(existingCart.Total); 
        existingItems.push(cartItem.stripeObject);
      }
      // Update the cart with the modified items
      await transaction.update(cartRef, { items: existingItems, Total: existingCart.Total });
      }
      return {status:'success', message: 'Product added to cart'};
  });
  }catch(error){
    throw error;
  }
  // Perform a transaction to ensure data consistency
}

// create user order with a pending status
async function createUserOrder(userId, cartItems, shippingAddress) {
  try {
    const orderData = {
      userId: userId,
      status: 'pending' // You can set the initial status of the order here
  };
    const collectionRef = db.collection('users_orders');
    await collectionRef.add({}); // Add an empty document to create the collection
} catch (error) {
    console.error('Error creating collection:', error);
}
}

// end-point to handle creation of user order
app.post("/beachbrossapi/order", async (request, response) => {
  try {
    const { userId,  shippingAddress } = request.body;
    const res = await createUserOrder(userId, shippingAddress);
    console.log(res)
    response.status(200).json({ message: res.message, status: res.status });
  }
  catch(error){
    response.status(500).json({ error: "Error creating user order" });
  }
})

// update prder status and user details
// shoud be handled as a result of either a successful or failed payment 
async function updateOrder(orderId, updatedData) {
  try {
      const orderRef = db.collection('orders'); 
      await orderRef.update(updatedData);
  } catch (error) {
    throw error;
  }
}
// end-point to handle update of user order
// it should happen when the user's payment is successful or fail
app.put("/beachbrossapi/order/:orderId", async (request, response) => {
  const orderId = request.params.orderId;
  const updatedData = request.body;
  try {
    await updateOrder(orderId, updatedData);
    response.status(200).send('Order updated successfully');
} catch (error) {
  response.status(500).send('Error updating order');
}
})
//make single payment
app.post("/beachbrossapi/pay", (request, response) =>{
    (async ()=>{
        try{
        const cartId = request.body.cartId;
        const cartRef = db.collection("cart").doc(cartId);
        const docSnapshot = await cartRef.get();
        if(docSnapshot.exists){
          const items = docSnapshot.data().items;
          const extractedData = items.map(item => {
           const price =  parseInt(item.price_data.unit_amount) * 100;
           item.price_data.unit_amount = price;
            return {
              price_data: item.price_data,
              quantity: item.quantity,
            };
          });

       const session = await stripe.checkout.sessions.create({
            // payment_method_types: ["card"],
            line_items: [...extractedData],
            mode: "payment",
            success_url: "http://localhost:4200/user/order-success?session_id={CHECKOUT_SESSION_ID}",
            cancel_url: "http://localhost:4200/user/order-canceled?session_id={CHECKOUT_SESSION_ID}",
        });
        return response.status(200).send({status:'success', message: 'payment successful', session})
      }
        }catch(error){
          return response.status(500).send({status:"Failed", error:error})
        }
    })()
})

app.post('/beachbrossapi/order/success', async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.retrieve(req.body.session_id);
    return res.status(200).send({status: 'success', session})
  }
  catch (error) {
    res.status(500).send({error: error.message});
  }
})

// clear the cart after successful payment

app.post('/beachbrossapi/clear-cart', async (req, res) => {
  try {
    const userId = req.body.userId;
    const cartRef = db.collection('cart').doc(userId);
    return cartRef.delete();
  }
  catch (error) {
    console.error("Error clearing cart", error);
    return res.status(500).send({error: error.message});
  }
})

// route to send sms using twillio
app.post('/beachbrossapi/send-sms', async (req, res) => {
  try {
    const { phone, message } = req.body;

    console.log(phone, message)

    if (!phone || !message) {
      return res.status(400).send({ error: 'Phone number and message are required.' });
    }

    const response = await client.messages.create({
      from: '+16364059475',
      to: phone,
      body: message
    });

    console.log('Message SID:', response.sid);
    res.status(200).send({ success: true, message: 'SMS sent successfully!', sid: response.sid });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send({ error: error.message });
  }
});



app.post('/beachbrossapi/order/cancel', async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.retrieve(req.body.session_id);
    console.log(session)
    return res.status(200).send({status: 'cancel', session})
  }
  catch (error) {
    res.status(500).send({error: error.message});
  }

})
async function getDocument(documentId, userId) {
  try {
    // Get a reference to the document
    const docRef = db.collection("Packages").doc(documentId);

    // Get the document snapshot
    const docSnapshot = await docRef.get();

    // Check if the document exists
    if (docSnapshot.exists) {
      const cartItem = docSnapshot.data();
      cartItem.productId = documentId;
      const cart = await addItemToCart(docRef, cartItem, userId);
      return cart;
    } else {
      return null;
    }
  } catch (error) {
    throw error; // You might handle this error differently in your application
  }
}


// send email when an orde is placed
async function main() {
  // send mail with defined transport object
  const info = await transporter.sendMail({
    from: '"Maddison Foo Koch 👻" <maddison53@ethereal.email>', // sender address
    to: "bar@example.com, baz@example.com", // list of receivers
    subject: "Hello ✔", // Subject line
    text: "Hello world?", // plain text body
    html: "<b>Hello world?</b>", // html body
  });
}
  app.post('/beachbrossapi/order', async (req, res) =>{
    const session_id = req.body.session_id; 

  })

  const transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
        user: 'kleresi@beachbrossharing.com', // Your Gmail address
        pass: 'ckzs gzly cwhe fcry' // Your Gmail password or App Password
    }
});

// Function to update order status in Firestore
async function updateOrderStatus(orderId, status) {
  try {
      const orderRef = db.collection('orders').doc(orderId);
      await orderRef.update({ status: status });
  } catch (error) {
      throw error;
  }
}

// Function to send payment confirmation email
function sendPaymentConfirmationEmail(email, orderDetails) {
  const mailOptions = {
      from: 'kevinleparwa@gmail.com',
      to: email,
      subject: 'Payment Confirmation',
      html: generateInvoiceHtml(orderDetails)
      // Add more order details as needed
  };

  transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
          console.error('Error sending email:', error);
      } else {
          console.log('Email sent:', info.response);
      }
  });
}

app.post('/beachbrossapi/send-email', async (req, res) =>{
  try {
  const {orderId, email, orderDetails } = req.body;
  updateOrderStatus(orderId, 'completed') // Update order status to 'completed' in Firestore
    .then(() => {
        sendPaymentConfirmationEmail(email, orderDetails); // Send email confirmation
    })
    .catch(error => {
        console.error('Error updating order status:', error);
    });
  }
  catch (error) {
    throw error
  }
})
// this is the last line, export our method cloud functions

function generateInvoiceHtml(invoice) {
  return `
  <div class="invoice-container" style="width: 80%; margin: auto; background-color: #fff; padding: 20px; box-shadow: 0 0 10px rgba(0,0,0,0.1); margin-top: 20px;">
      <div class="header" style="text-align: center; margin-bottom: 20px;">
          <h1>Invoice</h1>
          <p>Tax Invoice</p>
      </div>
      <div class="invoice-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <div>
              <h2>Beach Bros Sharing</h2>
              <p>Sea Terrace, Costa Mesa CA 92627, United States</p>
          </div>
          <div>
              <img src="https://firebasestorage.googleapis.com/v0/b/beachbrosshare.appspot.com/o/BEACH-BROS-LOGO-SOCAL.png?alt=media&token=dc524ea7-a520-4627-98ee-7d467dc085c8" alt="Company Logo" style="max-width: 150px;">
          </div>
      </div>
      <div class="invoice-details" style="margin-bottom: 20px;">
          <table>
              <tr>
                  <td><strong>Bill To:</strong></td>
                  <td>${invoice.userDetails.email}</td>
              </tr>
              <tr>
                  <td><strong>Invoice No.:</strong></td>
                  <td>${invoice.invoice_no}</td>
              </tr>
              <tr>
                  <td><strong>Pick Up Date:</strong></td>
                  <td>${invoice.shippingDetails.pick_date}</td>
              </tr>
              <tr>
                  <td><strong>Pick up Location:</strong></td>
                  <td>${invoice.shippingDetails.pick_location}</td>
              </tr>
              <tr>
                  <td><strong>Payment Method:</strong></td>
                  <td>${invoice.userDetails.name}</td>
              </tr>
          </table>
      </div>
      <div class="billing-details" style="margin-bottom: 20px;">
          <table class="details" style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
              <thead>
                  <tr>
                      <th style="border: 1px solid #ddd; padding: 8px; background-color: #f2f2f2;">Description</th>
                      <th style="border: 1px solid #ddd; padding: 8px; background-color: #f2f2f2;">Quantity</th>
                      <th style="border: 1px solid #ddd; padding: 8px; background-color: #f2f2f2;">Unit Price ($)</th>
                      <th style="border: 1px solid #ddd; padding: 8px; background-color: #f2f2f2;">Amount ($)</th>
                  </tr>
              </thead>
              <tbody>
                  ${invoice.invoiceItems.map(item => `
                  <tr>
                      <td style="border: 1px solid #ddd; padding: 8px;">${item.price_data.product_data.name}</td>
                      <td style="border: 1px solid #ddd; padding: 8px;">${item.quantity}</td>
                      <td style="border: 1px solid #ddd; padding: 8px;">${item.price_data.unit_amount}</td>
                      <td style="border: 1px solid #ddd; padding: 8px;">${item.price_data.unit_amount}</td>
                  </tr>`).join('')}
              </tbody>
          </table>
      </div>
      <div class="total" style="text-align: right; margin-top: 20px;">
          <p>Subtotal: ${invoice.sub_total}</p>
          <p>TAX 7.75% from ${invoice.amount_total}: -${invoice.tax_amount}</p>
          <h2>Total (USD): ${invoice.amount_total}</h2>
      </div>
  </div>
`;
}
exports.app = functions.https.onRequest(app)
