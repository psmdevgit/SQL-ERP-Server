const bcrypt = require("bcrypt");
const express = require("express");
const jsforce = require("jsforce");
const multer = require("multer");
require("dotenv").config();
const { addJewelryModel } = require("./addjewlery");
const chrome = require('@puppeteer/browsers');
const {submitOrder} = require("./submitOrder");
const app = express();
const storage = multer.memoryStorage();
const upload = multer({
  limits: {
    fieldSize: 10 * 1024 * 1024, // 10MB limit for field values
    fileSize: 10 * 1024 * 1024   // 10MB limit for files
  }
});
const nodemailer = require("nodemailer");

app.get("/", (req, res) => {
  res.send("Hello from Node.js running on IIS!");
});


// sql C  onnection
const { sql, poolPromise } = require("./dbConfig");

const fs = require('fs');
const path = require('path');
const os = require('os');
const puppeteer = require('puppeteer-core');
const cors = require('cors');
const axios = require('axios'); // Import axios
var bodyParser = require('body-parser');

// Configure body-parser with increased limits
app.use(bodyParser.json({ limit: '500mb' }));  // Increase as needed
app.use(bodyParser.urlencoded({ limit: '500mb', extended: true }));

// Also increase Express limit
app.use(express.json({ limit: '1gp' }));
app.use(express.urlencoded({ 
  limit: '1gp',
  extended: true
}));

//cors

app.use(cors({
  origin: [
    "app://-",  // Allow Electron app
    "app://.",  // Alternative Electron origin
    "http://localhost:3000", // Localhost for development
    "http://localhost:3001",
    "http://localhost:5001",
    "http://localhost:6001",
   "https://psmgoldcrafts-com.vercel.app/" ,
   "http://localhost:5173",
   'http://192.168.5.62',
   'http://192.168.5.62:99',
   'https://order.kalash.app',
   "https://order-portal-pi.vercel.app",
   "https://sql-erp-app.vercel.app",// Your Vercel frontend URL
    "file://" // For Electron file protocol
  ],
  credentials: true, // Allow credentials (cookies, authorization headers)
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"], // Allowed HTTP methods
  allowedHeaders: [
    "Content-Type", 
    "Authorization", 
    "Origin",
    "X-Requested-With",
    "Accept"
  ], // Allowed headers
  exposedHeaders: ["set-cookie"]
}));

// Add preflight handling
app.options('*', cors()); // Enable pre-flight for all routes

// Add error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error'
  });
});

// Middlew
app.use(express.json());

// Salesforce Connection
let conn;
let isSqlConnected = false;



// ✅ Serve files from the Upload folder
app.use("/Upload", express.static("D:/Kalash Sql/Needha_ERP_server-main/Upload"));

async function initializeSalesforceConnection() {
  try {
    conn = await sql.connect({
     user: process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  server: process.env.SQL_SERVER, // e.g., 'localhost'
  database: process.env.SQL_DATABASE,
      options: {
        encrypt: false, // set true for Azure
        trustServerCertificate: true,
      },
    });

    isSqlConnected = true;
    console.log("✅ Connected to SQL Server");
  } catch (error) {
    console.error("❌ SQL Connection Failed:", error.message || error);
    process.exit(1);
  }
}

// Initialize Salesforce Connection
// async function initializeSalesforceConnection() {
//   try {
//     conn = new jsforce.Connection({
//       loginUrl: process.env.SALESFORCE_LOGIN_URL,
//     });
//     await conn.login(process.env.SALESFORCE_USERNAME, process.env.SALESFORCE_PASSWORD);
//     isConnected = true;
//     console.log("Connected to Salesforce");
//   } catch (error) {
//     console.error("Failed to connect to Salesforce:", error.message || error);
//     process.exit(1);
//   }
// }
// initializeSalesforceConnection();

// Middleware to check Salesforce connection
  // if (!isConnected) {
  //   return res.status(500).json({ success: false, error: "Salesforce connection not established." });
  // }
  // next();
// ✅ Only check MSSQL


async function checkMssqlConnection(req, res, next) {
  try {
    const pool = await poolPromise; // Make sure poolPromise is defined and connected elsewhere
    if (!pool.connected) {
      return res.status(500).json({ success: false, error: "MSSQL connection not established." });
    }

    req.mssql = pool;
    next();
  } catch (err) {
    console.error("MSSQL connection error:", err);
    res.status(500).json({ success: false, error: "MSSQL connection error", details: err.message });
  }
}

// RENAMED SQL CONNECTION
async function checkSalesforceConnection(req, res, next) {
  try {
    const pool = await poolPromise;
    if (!pool.connected) {
      return res.status(500).json({ success: false, error: "MSSQL connection not established." });
    }

    req.mssql = pool;

    // ✅ Remove this if MSSQL is sufficient
    // if (!isConnected) {
    //   return res.status(500).json({ success: false, error: "Salesforce connection not established." });
    // }

    next();
  } catch (err) {
    console.error("Database connection check error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
}

/** ----------------- User Authentication ------------------ **/

// Login Endpoint

app.use(express.json());

// ===================================================================================================================
// ===================================================================================================================
// =====================================       order portal              =============================================
// ===================================================================================================================
// ===================================================================================================================

app.post("/api/vendor-login", async (req, res) => {
  try {
    
    const pool = await poolPromise;

    const { mobile, password } = req.body;
    console.log("data : ",req.body)

    if (!mobile || !password)
      return res.status(400).json({ error: "Missing mobile or password" });


const result = await pool
  .request()
  .input("mobile", sql.VarChar, mobile)
  .input("password", sql.VarChar, password)
  .query(`
    SELECT TOP 1 * FROM VendorMaster
    WHERE mobile = @mobile AND passcode = @password
  `);


    if (result.recordset.length > 0) {
      res.json({ success: true, user: result.recordset[0] });
    } else {
      res.status(401).json({ success: false, message: "Invalid mobile or password" });
    }
  } catch (err) {
    console.error("Login Error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/save-customer-details", async (req, res) => {
  try {
    const pool = await poolPromise;

    // const { customerName, customerMobile, customerEmail, vendorName, vendorMobile, vendorEmail } = req.body;

    const { customerName, customerMobile, customerEmail, vendorName, vendorMobile, vendorEmail } = req.body;


    console.log("🟢 Received body:", req.body);


    if (!customerName || !customerMobile)
      return res.status(400).json({ success: false, message: "Missing customer info" });

    await pool.request().query`
      INSERT INTO CustomerDetails (customerName, customerMobile, customerEmail, vendorName, vendorMobile, vendorEmail, createdDate)
      VALUES (${customerName}, ${customerMobile}, ${customerEmail}, ${vendorName}, ${vendorMobile}, ${vendorEmail}, getdate())
    `;

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Save Customer Error:", err);
    res.status(500).json({ success: false, message: "Database error" });
  }
});


app.get("/api/users", async (req, res) => {
  try {
    const pool = await poolPromise;

    const result = await pool.request().query(`
      SELECT 
        id,
        Customer_Name,
        Customer_mobile_no,
        customerEmail,
        Vendor_Name,
        Vendor_Mobile_no,
        email,
        Active_flag,
        Created_date
      FROM Order_Login
      WHERE Active_flag = 's'
    `);

    // Map SQL result to customer/vendor arrays
    const customers = result.recordset.map(r => ({
      id: r.id,
      customerName: r.Customer_Name,
      customerMobile: r.Customer_mobile_no,
      customerEmail: r.customerEmail,
      vendorName: r.Vendor_Name,
      vendorMobile: r.Vendor_Mobile_no,
    }));

    // If you want to separate vendors as well:
    const vendors = result.recordset.map(r => ({
      id: r.id,
      name: r.Vendor_Name,
      mobile: r.Vendor_Mobile_no,
      email: r.email,
    }));

    res.json({ customers, vendors });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database query failed" });
  }
});

app.post("/api/users", async (req, res) => {
  try {
    const { role, user } = req.body;
    const pool = await poolPromise;

    if (role === "customer") {
      // Insert customer along with vendor info into Order_Login
      await pool.request()
        .input("Customer_Name", sql.NVarChar, user.customerName)
        .input("Customer_mobile_no", sql.NVarChar, user.customerMobile)
        .input("customerEmail", sql.NVarChar, user.customerEmail)
        .input("Vendor_Name", sql.NVarChar, user.vendorName)
        .input("Vendor_Mobile_no", sql.NVarChar, user.vendorMobile)
        .input("Active_flag", sql.NVarChar, "s")
        .input("Role", sql.NVarChar, role.trim())
        .input("Created_date", sql.DateTime, new Date())
        .query(`
          INSERT INTO Order_Login 
          (Customer_Name, Customer_mobile_no, Vendor_Name, Vendor_Mobile_no, Active_flag, Created_date, role, customerEmail)
          VALUES (@Customer_Name, @Customer_mobile_no, @Vendor_Name, @Vendor_Mobile_no, @Active_flag, @Created_date, @Role, @customerEmail)
        `);
    }

    if (role === "vendor") {
      // Insert vendor as a new row with empty customer fields
      await pool.request()
        .input("Customer_Name", sql.NVarChar, "")
        .input("Customer_mobile_no", sql.NVarChar, "")
        .input("Vendor_Name", sql.NVarChar, user.name)
        .input("Vendor_Mobile_no", sql.NVarChar, user.mobile)
        .input("email", sql.NVarChar, user.email)
        .input("Active_flag", sql.NVarChar, "s")
        .input("Role", sql.NVarChar, role.trim())
        .input("Created_date", sql.DateTime, new Date())
        .query(`
          INSERT INTO Order_Login 
          (Customer_Name, Customer_mobile_no, Vendor_Name, Vendor_Mobile_no, Active_flag, Created_date, role, email)
          VALUES (@Customer_Name, @Customer_mobile_no, @Vendor_Name, @Vendor_Mobile_no, @Active_flag, @Created_date, @Role, @email)
        `);
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to insert user into database" });
  }
});

// ====================================================================================================================================

// check the model if not insert that

app.post("/api/models/check-or-insert", async (req, res) => {
  try {
    const { Modelname, modelNo, status, Modelpath, VendorCode, CreatedDate } = req.body;

    
    const pool = await poolPromise;

    // const pool = await sql.connect(config);

    // Check if model already exists
    const check = await pool.request()
      .input("Modelname", sql.VarChar, Modelname)
      .query("SELECT * FROM model_master WHERE Modelname = @Modelname");

    if (check.recordset.length === 0) {
      // Insert new model
      await pool.request()
        .input("Modelname", sql.VarChar, Modelname)
        .input("modelNo", sql.VarChar, modelNo)
        .input("status", sql.Char, status)
        .input("Modelpath", sql.VarChar, Modelpath)
        .input("VendorCode", sql.VarChar, VendorCode)
        .input("CreatedDate", sql.DateTime, CreatedDate)
        .query(`INSERT INTO model_master (Modelname, modelNo, status, Modelpath, VendorCode, CreatedDate)
                VALUES (@Modelname, @modelNo, @status, @Modelpath, @VendorCode, @CreatedDate)`);
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});
//=========================================================================================================================

// Last order id get

// ✅ Get Last Order ID
app.get("/api/lastorder", async (req, res) => {
  try {
    
    const pool = await poolPromise;

    const result = await pool
      .request()
      .query("SELECT TOP 1 orderid FROM Order_Details ORDER BY createdDate DESC");

    if (result.recordset.length > 0) {
      res.json({ lastOrderId: result.recordset[0].orderid });
    } else {
      res.json({ lastOrderId: null });
    }
  } catch (err) {
    console.error("❌ Error fetching last order:", err);
    res.status(500).json({ error: "Error fetching last order" });
  }
});

//==========================================================================================================================

app.post("/api/itemorders", async (req, res) => {
  const orderData = req.body;
  console.log("Received order:", orderData);

  try {
    const pool = await poolPromise;

  // Determine fields based on role

// let vendorName = null;
// let vendorMobile = null;
// let customerName = null;
// let customerMobile = null;

let vendorName = orderData.user.vendorName;
let vendorMobile = orderData.user.vendorMobile;
let vendorEmail = orderData.user.vendorEmail;
let customerName = orderData.user.customerName;
let customerMobile = orderData.user.customerMobile;
let customerEmail = orderData.user.customerEmail;

// if (orderData.user.role === "vendor") {
//   vendorName = orderData.user.name || orderData.user.vendorName;
//   vendorMobile = orderData.user.mobile || orderData.user.vendorMobile;
//   customerName = orderData.user.customerName;
//   customerMobile = orderData.user.customerMobile;
// } else if (orderData.user.role === "customer") {
//   customerName = orderData.user.name || orderData.user.customerName;
//   customerMobile = orderData.user.mobile || orderData.user.customerMobile;
//   vendorName = orderData.user.vendorName;
//   vendorMobile = orderData.user.vendorMobile;
// }

// Insert into order_details
const orderDetailsQuery = `
  INSERT INTO order_details
    (OrderId, Vendor_name, Vendor_mobileno, Vendor_email, Customer_Name, Customer_mobileNo, customer_email, NoOfModel, status, createdDate)
  VALUES
    (@OrderId, @Vendor_name, @Vendor_mobileno, @Vendor_email, @Customer_Name, @Customer_mobileNo, @Customer_email, @NoOfModel, @status, @createdDate)
`;

await pool.request()
  .input("OrderId", sql.VarChar, orderData.orderId)
  .input("Vendor_name", sql.VarChar, vendorName)
  .input("Vendor_mobileno", sql.VarChar, vendorMobile)
  .input("Vendor_email", sql.VarChar, vendorEmail)
  .input("Customer_Name", sql.VarChar, customerName)
  .input("Customer_mobileNo", sql.VarChar, customerMobile)
  .input("Customer_email", sql.VarChar, customerEmail)
  .input("NoOfModel", sql.Int, orderData.models.length)
  .input("status", sql.VarChar, "Pending")
  .input("createdDate", sql.DateTime, new Date())
  .query(orderDetailsQuery);

    // 2️⃣ Insert into order_items
    const insertItemQuery = `
      INSERT INTO order_items
        (Order_Id, Item_Name, ModelNo, Quantity, status, Order_Date, ModelPath, createdDate)
      VALUES
        (@Order_Id, @Item_Name, @ModelNo, @Quantity, @status, @Order_Date, @ModelPath, @createdDate)
    `;

    for (const item of orderData.models) {
      await pool.request()
        .input("Order_Id", sql.VarChar, orderData.orderId)
        .input("Item_Name", sql.VarChar, item.name)
        .input("ModelNo", sql.VarChar, item.code)
        .input("Quantity", sql.Int, item.quantity)
        .input("status", sql.VarChar, "Pending")
        .input("Order_Date", sql.DateTime, new Date())
        .input("ModelPath", sql.VarChar, item.image)
        .input("createdDate", sql.DateTime, new Date())
        .query(insertItemQuery);
    }

    res.json({ success: true, message: `Order ${orderData.orderId} saved successfully.` });
  } catch (err) {
    console.error("Error inserting order:", err);
    res.status(500).json({ success: false, error: "Failed to save order" });
  }
});
app.get("/api/ordersDetails", async (req, res) => {

  const mobile = req.query.mobile;

  console.log(mobile);


  try {

    const pool = await poolPromise;

    // 🔹 Step 1: Get order details for this mobile
    const orderDetailsQuery = `
      SELECT * FROM Order_Details
      WHERE Vendor_mobileno = @mobile OR Customer_mobileNo = @mobile
      ORDER BY createdDate DESC
    `;
    const orderResult = await pool
      .request()
      .input("mobile", sql.VarChar, mobile)
      .query(orderDetailsQuery);

    const orders = orderResult.recordset;

    if (orders.length === 0) return res.json([]);

    // 🔹 Step 2: Get all order items for these orders
    const orderIds = orders.map(o => o.OrderId);
    const orderItemsQuery = `
      SELECT * FROM Order_Items
      WHERE Order_Id IN (${orderIds.map((_, i) => `@id${i}`).join(",")})
      ORDER BY createdDate ASC
    `;
    const request = pool.request();
    orderIds.forEach((id, i) => request.input(`id${i}`, sql.VarChar, id));
    const itemsResult = await request.query(orderItemsQuery);

    const items = itemsResult.recordset;

    // 🔹 Step 3: Attach items to respective orders
    const ordersWithItems = orders.map(order => ({
      ...order,
      items: items.filter(item => item.Order_Id === order.OrderId)
    }));

    res.json(ordersWithItems);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/send-email", async (req, res) => {
  console.log("📨 Incoming email data:", req.body);

  try {
    const { to, subject, message, pdfBase64, filename, customerEmail, vendorEmail } = req.body;

    // ✅ Define recipients based on role
    let recipients = [];

    recipients.push(customerEmail);
    recipients.push(vendorEmail); 

    // ✅ Always include the common email
    recipients.push("mis@pothysswarnamahal.com");

    // Remove duplicates and empty values
    recipients = [...new Set(recipients.filter((r) => r && r.includes("@")))];

    if (recipients.length === 0) {
      console.error("❌ No valid recipients found");
      return res.status(400).json({ error: "No valid email recipients" });
    }

    console.log("📬 Sending email to:", recipients);

    // ✅ Configure transporter
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false, // TLS
      auth: {
        user: "kalashapps@gmail.com",
        pass: "pyko quft cmbr kvzy", // App password
      },
    });

    // ✅ Setup mail options
    const mailOptions = {
      from: "kalashapps@gmail.com",
      to: recipients, // array of recipients
      subject,
      text: message,
      attachments: [
        {
          filename,
          content: Buffer.from(pdfBase64, "base64"),
          contentType: "application/pdf",
        },
      ],
    };

    // ✅ Send mail
    await transporter.sendMail(mailOptions);
    console.log("📧 Email sent successfully to", recipients);
    res.json({ success: true });
  } catch (error) {
    console.error("❌ Error sending email:", error);
    res.status(500).json({ error: "Failed to send email" });
  }
});

app.get("/api/models", async (req, res) => {
  try {
    const pool = await poolPromise;

    const result = await pool.request().query(`
      SELECT 
        id,
        Modelname,
        modelNo,
        status,
        Modelpath,
        VendorCode,
        CreatedDate
      FROM Model_Master
      WHERE status = 'A'  -- optional filter for active models
    `);

    // Map the result to a frontend-friendly format
    const models = result.recordset.map(m => ({
      id: m.id,
      name: m.Modelname,
      code: m.modelNo,
      status: m.status.trim(),
      image: m.Modelpath,     // Assuming you store path here
      vendorCode: m.VendorCode,
      createdDate: m.CretaedDate,
    }));

    res.json(models);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch models from database" });
  }
});

//=========================================================================================================================
//=========================================================================================================================
//=========================================================================================================================

//  =======================================         Kalash Jewellers        ===============================================

//=========================================================================================================================
//=========================================================================================================================
//=========================================================================================================================


app.post("/login",checkSalesforceConnection, async (req, res) => {
  try {
    const pool = req.mssql; // Get the MSSQL pool from the request
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ 
        success: false, 
        error: "Username and password are required." 
      });
    }

    const query = `
      SELECT TOP 1 Id, Username_c, Password_c, Status_c
      FROM CustomUser__c
      WHERE Username_c = @username
    `;

    const result = await pool
      .request()
      .input("username", username)
      .input("password", password)
      .query(query);

    if (result.recordset.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: "User not found." 
      });
    }

    const user = result.recordset[0];

    if (user.Status_c !== "Active") {
      return res.status(403).json({ 
        success: false, 
        error: "User is inactive." 
      });
    }



    if (password !== user.Password_c) {
      return res.status(401).json({ 
        success: false, 
        error: "Invalid password." 
      });
    }

    res.json({ 
      success: true, 
      message: "Login successful", 
      userId: user.Id,
      username: user.Username_c
    });

  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ 
      success: false, 
      error: "Internal server error",
      details: error.message 
    });
  }
});


app.post("/add-item-group", checkSalesforceConnection, async (req, res) => {
  try {
    const pool = req.mssql;
    const { itemGroupName, description } = req.body;

    if (!itemGroupName || itemGroupName.trim() === "") {
      return res.status(400).json({ success: false, error: "Item group name is required." });
    }

    // Optional: Check if item group already exists
    const checkQuery = `
      SELECT * FROM ItemGroup__c WHERE ItemGroupName_c = @itemGroupName
    `;
    const checkResult = await pool.request()
      .input("itemGroupName", itemGroupName)
      .query(checkQuery);

    if (checkResult.recordset.length > 0) {
      return res.status(409).json({ success: false, error: "Item group already exists." });
    }

    // Insert new item group
    const insertQuery = `
      INSERT INTO ItemGroup_c (ItemGroupName__c, Description__c,Created_date)
      VALUES (@itemGroupName, @description,getdate())
    `;
    await pool.request()
      .input("itemGroupName", itemGroupName)
      .input("description", description || null)
      .query(insertQuery);

    res.json({
      success: true,
      message: "Item group inserted successfully."
    });

  } catch (error) {
    console.error("Error in /add-item-group:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});


// //    const insertQuery = `
//       INSERT INTO Product_Group__c (ProductGroupName_c,created_date)
//       VALUES (@productGroupName,getdate())
//     `;
// //     `;
const mssql = require("mssql");
const { log, Console } = require("console");

app.post("/add-product-group", checkSalesforceConnection, async (req, res) => {
  try {
    const pool = req.mssql; // SQL pool from middleware
    const { productGroupName } = req.body;

    if (!productGroupName) {
      return res.status(400).json({
        success: false,
        error: "Product group name is required.",
      });
    }

    // ✅ 1. Check if product group already exists
    const checkQuery = `
      SELECT COUNT(*) as count
      FROM Product_Group__c
      WHERE ProductGroupName_c = @productGroupName
    `;

    const checkResult = await pool
      .request()
      .input("productGroupName", mssql.VarChar, productGroupName)
      .query(checkQuery);

    if (checkResult.recordset[0].count > 0) {
      return res.status(409).json({
        success: false,
        error: "Product group already exists.",
      });
    }

    // ✅ 2. Insert new product group
    const insertQuery = `
      INSERT INTO Product_Group__c (ProductGroupName_c, created_date)
      VALUES (@productGroupName, GETDATE())
    `;

    await pool
      .request()
      .input("productGroupName", mssql.VarChar, productGroupName)
      .query(insertQuery);

    res.json({
      success: true,
      message: "Product group inserted successfully.",
    });
  } catch (error) {
    console.error("Error inserting product group:", error);
    res.status(500).json({
      success: false,
      error: "SQL insertion failed",
      details: error.message,
    });
  }
});



// Create Size Group


app.post("/add-size-group", checkSalesforceConnection, async (req, res) => {
  try {
    const pool = req.mssql; // SQL pool from middleware
    const { sizeGroupName } = req.body;

    if (!sizeGroupName) {
      return res.status(400).json({
        success: false,
        error: "Size group name is required.",
      });
    }

    // ✅ 1. Check if size group already exists
    const checkQuery = `
      SELECT COUNT(*) as count
      FROM jewlerysize__c
      WHERE Size__c = @sizeGroupName
    `;

    const checkResult = await pool
      .request()
      .input("sizeGroupName", mssql.VarChar, sizeGroupName)
      .query(checkQuery);

    if (checkResult.recordset[0].count > 0) {
      return res.status(409).json({
        success: false,
        error: "Size group already exists.",
      });
    }

    // ✅ 2. Insert new size group
    const insertQuery = `
      INSERT INTO jewlerysize__c (Size__c, created_date)
      VALUES (@sizeGroupName, GETDATE())
    `;

    await pool
      .request()
      .input("sizeGroupName", mssql.VarChar, sizeGroupName)
      .query(insertQuery);

    res.json({
      success: true,
      message: "Size group inserted successfully.",
    });
  } catch (error) {
    console.error("Error inserting size group:", error);
    res.status(500).json({
      success: false,
      error: "SQL insertion failed",
      details: error.message,
    });
  }
});


app.post("/api/grinding/create",checkSalesforceConnection, async (req, res) => {
  try {
    const pool = req.mssql; // ✅ ensure mssql is available

    const {
      grindingId,
      issuedDate,
      pouches,
      totalWeight,
      status,
      product,
      quantity,
      orderId
    } = req.body;

    // 🔁 Insert into Grinding__c
    const insertGrindingQuery = `
      INSERT INTO Grinding__c (
        Name, Issued_Date_c, Issued_Weight_c,
        Status_c, Product_c, Quantity_c, Order_Id_c,LastModifiedBy_Name,IsDeleted,CreatedDate,LastModifiedDate,LastModifiedById
      )
      OUTPUT INSERTED.Id
      VALUES (
        @grindingId, @issuedDate, @totalWeight,
        @status, @product, @quantity, @orderId,'005IU00000AstS6YAJ','false',GETDATE(),getdate(),'005IU00000AstS6YAJ'
      )
    `;

    const grindingInsertResult = await pool.request()
      .input("grindingId", mssql.VarChar, grindingId)
      .input("issuedDate", mssql.DateTime, new Date(issuedDate))
      .input("totalWeight", mssql.Decimal(18, 2), totalWeight)
      .input("status", mssql.VarChar, status)
      .input("product", mssql.VarChar, product)
      .input("quantity", mssql.Int, quantity)
      .input("orderId", mssql.VarChar, orderId)
      .query(insertGrindingQuery);

    const grindingRecordId = grindingInsertResult.recordset[0].Id;

    // 🔁 Update Pouch__c table
    const pouchResults = await Promise.all(pouches.map(async (pouch) => {
      const updateQuery = `
        UPDATE Pouch__c
        SET 
          Grinding_c = @grindingRecordId,
          Isssued_Weight_Grinding_c = @grindingWeight,
          Quantity_c = @quantity,
          LastModifiedDate = GETDATE()
        WHERE Id = @pouchId
      `;

      const result = await pool.request()
        .input("grindingRecordId", mssql.VarChar, grindingRecordId)
        .input("grindingWeight", mssql.Decimal(18, 2), pouch.grindingWeight)
        .input("quantity", mssql.Int, pouch.quantity)
        .input("pouchId", mssql.Int, pouch.pouchId)
        .query(updateQuery);

      return {
        pouchId: pouch.pouchId,
        updated: result.rowsAffected[0] > 0
      };

    }));

    res.json({
      success: true,
      message: "Grinding record created and pouches updated successfully",
      data: {
        grindingId,
        grindingRecordId,
        pouches: pouchResults
      }
    });

  } catch (error) {
    console.error("[Grinding Create] Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create grinding record",
      details: error.message
    });
  }
});

app.post("/add-jewelry-category",checkSalesforceConnection, async (req, res) => {
  try {
    const pool = req.mssql; // make sure `mssql` is bound to req (via middleware)

    const {
      itemGroup = null,
      categoryName = null,
      categoryCode = null,
      productGroup = null,
      rate = null,
      hsn = null,
      maxOrderQty = null,
      size = null,
      color = null,
    } = req.body;

    if (!categoryName || !categoryCode) {
      return res.status(400).json({
        success: false,
        error: "Category Name and Category Code are required fields.",
      });
    }

    const insertQuery = `
      INSERT INTO Jewelry_Category__c (
        ItemGroup_c,
        Name,
        Category_Code_c,
        Product_Group_c,
        Rate_c,
        HSN_c,
        Max_Order_Qty_c,
        size_c,
         Color_c,
         CreatedDate,
        CreatedDate_c,
        LastModifiedDate,
        LastModifiedBy_Name

      )
      VALUES (
        @itemGroup,
        @categoryName,
        @categoryCode,
        @productGroup,
        @rate,
        @hsn,
        @maxOrderQty,
        @size,
        @color,
        GETDATE(),
         GETDATE(),
        GETDATE(),
        'PSM GOLD CRAFTS'
      );
    `;

    await pool.request()
      .input("itemGroup", mssql.VarChar, itemGroup)
      .input("categoryName", mssql.VarChar, categoryName)
      .input("categoryCode", mssql.VarChar, categoryCode)
      .input("productGroup", mssql.VarChar, productGroup)
      .input("rate", mssql.Decimal(18, 2), rate)
      .input("hsn", mssql.VarChar, hsn)
      .input("maxOrderQty", mssql.Int, maxOrderQty)
      .input("size", mssql.VarChar, size)
      .input("color", mssql.VarChar, color)
      .query(insertQuery);

    res.status(200).json({
      success: true,
      message: "Jewelry category added successfully to SQL Server",
    });

  } catch (error) {
    console.error("Error adding jewelry category to SQL:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      details: error.message,
    });
  }
});



/**----------------------Order Management---------------**/


// async function insertOrderToSQL(orderData, fileName) {
//   try {
//     const pool = await poolPromise;

//     const {
//       partyCode,
//       partyName,
//       orderNo,
//       orderDate,
//       category,
//       purity,
//       advanceMetal,
//       advanceMetalPurity,
//       priority,
//       deliveryDate,
//       remark,
//       createdBy,
//       status,
//     } = orderData.orderInfo;

//     const totalQuantity = orderData.totalQuantity;

//     // 1. Insert into Orders__c
//     await pool.request()
//       .input("Order_No__c", sql.NVarChar, orderNo)
//       .input("Order_Date__c", sql.Date, orderDate)
//       .input("Party_Code__c", sql.NVarChar, partyCode)
//       .input("Party_Name__c", sql.NVarChar, partyName)
//       .input("Category__c", sql.NVarChar, category)
//       .input("Purity__c", sql.NVarChar, purity)
//       .input("Advance_Metal__c", sql.Decimal(18, 2), advanceMetal)
//       .input("Advance_Metal_Purity__c", sql.Decimal(18, 2), advanceMetalPurity)
//       .input("Priority__c", sql.NVarChar, priority)
//       .input("Delivery_Date__c", sql.Date, deliveryDate)
//       .input("Remark__c", sql.NVarChar, remark)
//       .input("Created_By__c", sql.NVarChar, createdBy)
//       .input("Status__c", sql.NVarChar, status)
//       .input("Total_Quantity__c", sql.Int, totalQuantity)
//       .input("File_Name__c", sql.NVarChar, fileName)
//       .query(`
//         INSERT INTO Order__c (
//           Name, CreatedDate_c, Party_Code_c, Party_Name_c, Category_c,
//           Purity_c, Advance_Metal_c, Advance_Metal_Purity_c, Priority_c,
//           Delivery_Date_c, Remarks_c, Created_By_c, Status_c,
//           Total_Quantity_c, image_c,LastModifiedDate,Created_Date_c,Order_Id_c
//         )
//         VALUES (
//           @Order_No__c, @Order_Date__c, @Party_Code__c, @Party_Name__c, @Category__c,
//           @Purity__c, @Advance_Metal__c, @Advance_Metal_Purity__c, @Priority__c,
//           @Delivery_Date__c, @Remark__c, @Created_By__c, @Status__c,
//           @Total_Quantity__c, @File_Name__c,getdate(),getdate(),@Order_No__c
//         )
//       `);

//     // 2. Insert into Order_Items__c (loop through items)
//     for (const item of orderData.items) {
//       await pool.request()
//         .input("Order_No__c", sql.NVarChar, orderNo)
//         .input("Category__c", sql.NVarChar, item.category)
//         .input("Weight_Range__c", sql.NVarChar, item.weightRange)
//         .input("Size__c", sql.NVarChar, item.size)
//         .input("Quantity__c", sql.Int, item.quantity)
//         .input("Remark__c", sql.NVarChar, item.remark)
//         .query(`
//           INSERT INTO Order_Items__c (
//             Order_No_c, Category_c, Weight_Range_c, Size_c, Quantity_c, Remark_c
//           )
//           VALUES (
//             @Order_No__c, @Category__c, @Weight_Range__c, @Size__c, @Quantity__c, @Remark__c
//           )
//         `);
//     }

//     return { message: "Order and items inserted successfully" };

//   } catch (error) {
//     console.error("SQL Insert Error:", error);
//     throw error;
//   }
// }


// app.post("/api/orders", upload.single("file"), async (req, res) => {
//   try {
//     const orderData = JSON.parse(req.body.orderData); // full JSON payload
//     const fileName = req.file ? req.file.filename : null;

//     console.log("Received order data:", orderData);

//     const result = await insertOrderToSQL(orderData, fileName);

//     res.status(200).json({
//       success: true,
//       message: result.message,
//       fileName: fileName,
//     });

//   } catch (error) {
//     console.error("Error saving order:", error);
//     res.status(500).json({
//       success: false,
//       message: "Error saving order",
//       error: error.message,
//     });
//   }
// });



// app.post('/api/orders', upload.single('pdfFile'), async (req, res) => {
//   try {
//       const orderData = JSON.parse(req.body.orderData);
//       const result = await submitOrder(conn, orderData, req.file);
      
//       res.json({
//           success: true,
//           message: 'Order saved successfully',
//           data: result
//       });

//   } catch (error) {
//       console.error('Error saving order:', error);
//       res.status(500).json({
//           success: false,
//           message: 'Error saving order',
//           error: error.message
//       });
//   }
// });

/**-----------------Ordrer status------------------- */
// app.post("/api/update-order-status", async (req, res) => {
//   try {
//     const { orderId } = req.body;

//     if (!orderId) {
//       return res.status(400).json({
//         success: false,
//         message: "Order ID is required"
//       });
//     }

//     // First get the Salesforce record ID for the order
//     const orderQuery = await conn.query(
//       `SELECT Id FROM Order_c WHERE Order_Id__c = '${orderId}' LIMIT 1`
//     );

//     if (!orderQuery.records || orderQuery.records.length === 0) {
//       return res.status(404).json({
//         success: false,
//         message: "Order not found"
//       });
//     }

//     // Update the order status
//     const updateResult = await conn.sobject('Order__c').update({
//       Id: orderQuery.records[0].Id,
//       Status_c: 'Finished'
//     });

//     if (!updateResult.success) {
//       throw new Error('Failed to update order status');
//     }

//     res.json({
//       success: true,
//       message: "Order status updated successfully",
//       data: {
//         orderId,
//         status: 'Finished'
//       }
//     });

//   } catch (error) {
//     console.error("Error updating order status:", error);
//     res.status(500).json({
//       success: false,
//       message: error.message || "Failed to update order status"
//     });
//   }
// });


// app.post("/api/update-order-status", async (req, res) => {
//   const { orderId } = req.body;

//   if (!orderId) {
//     return res.status(400).json({
//       success: false,
//       message: "Order ID is required"
//     });
//   }

//   try {
//     const pool = await poolPromise;

//     // Step 1: Check if order exists
//     const checkResult = await pool
//       .request()
//       .input("orderId", sql.NVarChar, orderId)
//       .query("SELECT Order_Id_c FROM Order__c WHERE Order_Id_c = @orderId");

//     if (checkResult.recordset.length === 0) {
//       return res.status(404).json({
//         success: false,
//         message: `Order with ID ${orderId} not found`
//       });
//     }

//     // Step 2: Update the order status
//     await pool
//       .request()
//       .input("orderId", sql.NVarChar, orderId)
//       .input("status", sql.NVarChar, "Finished")
//       .query("UPDATE Order__c SET Status_c = @status WHERE Order_Id_c = @orderId");

//     res.json({
//       success: true,
//       message: "Order status updated successfully",
//       data: {
//         orderId,
//         status: "Finished"
//       }
//     });

//   } catch (error) {
//     console.error("MSSQL error:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to update order status",
//       error: error.message
//     });
//   }
// });



/**------------------- Inventory Management-------------------- **/


// app.post("/update-inventory", async (req, res) => {
//   try {
//     const { itemName, purity, availableWeight, unitOfMeasure } = req.body;

//     console.log('Received inventory update request:', {
//       itemName,
//       purity,
//       availableWeight,
//       unitOfMeasure
//     });

//     if (!itemName || !purity || !availableWeight || !unitOfMeasure) {
//       return res.status(400).json({
//         success: false,
//         message: "All fields are required"
//       });
//     }

//     const pool = await poolPromise;

//     // Check if item exists
//     const checkResult = await pool.request()
//       .input("itemName", sql.NVarChar, itemName)
//       .input("purity", sql.NVarChar, purity)
//       .query(`
//         SELECT Id, Available_weight_c, Unit_of_Measure_c
//         FROM Inventory_ledger__c
//         WHERE Item_Name_c = @itemName AND Purity_c = @purity
//       `);

//     let result;
//     let responseData = {};

//     if (checkResult.recordset.length > 0) {
//       const currentRecord = checkResult.recordset[0];
//       const currentWeight = parseFloat(currentRecord.Available_weight || 0);
//       const newTotalWeight = currentWeight + parseFloat(availableWeight);

//       // Update existing record
//       await pool.request()
//         .input("id", sql.Int, currentRecord.Id)
//         .input("weight", sql.Float, newTotalWeight)
//         .input("unit", sql.NVarChar, unitOfMeasure)
//         .input("updated", sql.DateTime, new Date())
//         .query(`
//           UPDATE Inventory_ledger__c
//           SET Available_weight_c = @weight,
//               Unit_of_Measure_c = @unit,
//               Last_Updated_c = @updated
//           WHERE Id = @id
//         `);

//       result = { success: true };
//       responseData = {
//         currentWeight,
//         addedWeight: parseFloat(availableWeight),
//         newTotalWeight
//       };
//     } else {
//       // Insert new record
//       await pool.request()
//         .input("itemName", sql.NVarChar, itemName)
//         .input("purity", sql.NVarChar, purity)
//         .input("weight", sql.Float, parseFloat(availableWeight))
//         .input("unit", sql.NVarChar, unitOfMeasure)
//         .input("updated", sql.DateTime, new Date())
//         .query(`
//           INSERT INTO Inventory_ledger__c 
//           (Item_Name_c, Purity_c, Available_weight_c, Unit_of_Measure_c, Last_Updated_c)
//           VALUES (@itemName, @purity, @weight, @unit, @updated)
//         `);

//       result = { success: true };
//       responseData = {
//         currentWeight: 0,
//         addedWeight: parseFloat(availableWeight),
//         newTotalWeight: parseFloat(availableWeight)
//       };
//     }

//     res.status(200).json({
//       success: true,
//       message: "Inventory updated successfully",
//       data: responseData
//     });

//   } catch (error) {
//     console.error("Error updating inventory:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to update inventory",
//       error: error.message
//     });
//   }
// });

// app.post("/api/casting/update/:date/:month/:year/:number", async (req, res) => {
//   try {
//     const { date, month, year, number } = req.params;
//     const { receivedDate, receivedWeight, castingLoss, scrapReceivedWeight, dustReceivedWeight, ornamentWeight } = req.body;
//     const castingNumber = `${date}/${month}/${year}/${number}`;

//     // Format the received date to S0alesforce format
//     const formattedDate = new Date(receivedDate).toISOString();

//     console.log('Looking for casting number:', castingNumber);
//     console.log('Update data:', { 
//       receivedDate: formattedDate, 
//       receivedWeight, 
//       castingLoss, 
//       scrapReceivedWeight,
//       dustReceivedWeight, 
//       ornamentWeight 
//     });

//     // First get the Casting record
//     const castingQuery = await conn.query(
//       `SELECT Id, Name, Required_Purity__c FROM Casting_dept__c WHERE Name = '${castingNumber}'`
//     );

//     if (!castingQuery.records || castingQuery.records.length === 0) {
//       return res.status(404).json({
//         success: false,
//         message: "Casting not found"
//       });
//     }

//     const casting = castingQuery.records[0];

//     // Update the casting record
//     const updateData = {
//       Id: casting.Id,
//       Received_Date__c: formattedDate,
//       Weight_Received__c: receivedWeight,
//       Casting_Loss__c: castingLoss,
//       Casting_Scrap_Weight__c: scrapReceivedWeight,
//       Casting_Dust_Weight__c: dustReceivedWeight,
//       Casting_Ornament_Weight__c: ornamentWeight,
//       Status__c: 'Finished'
//     };

//     const updateResult = await conn.sobject('Casting_dept__c').update(updateData);

//     if (!updateResult.success) {
//       throw new Error('Failed to update casting record');
//     }

//     // Check if scrap inventory exists for this purity
//     const scrapInventoryQuery = await conn.query(
//       `SELECT Id, Available_weight__c FROM Inventory_ledger__c 
//        WHERE Item_Name__c = 'scrap'
//        AND Purity__c = '91.7%'
//        `
//     );

//     if (scrapReceivedWeight > 0) {
//       if (scrapInventoryQuery.records.length > 0) {
//         // Update existing scrap inventory
//         const currentWeight = scrapInventoryQuery.records[0].Available_weight__c || 0;
//         const scrapUpdateResult = await conn.sobject('Inventory_ledger__c').update({
//           Id: scrapInventoryQuery.records[0].Id,
//           Available_weight__c: currentWeight + scrapReceivedWeight,
//           Last_Updated__c: formattedDate
//         });

//         if (!scrapUpdateResult.success) {
//           throw new Error('Failed to update scrap inventory');
//         }
//       } else {
//         // Create new scrap inventory
//         const scrapCreateResult = await conn.sobject('Inventory_ledger__c').create({
//           Name: 'Scrap',
//           Item_Name__c: 'Scrap',
//           Purity__c: casting.Required_Purity__c,
//           Available_weight__c: scrapReceivedWeight,
//           Unit_of_Measure__c: 'Grams',
//           Last_Updated__c: formattedDate
//         });

//         if (!scrapCreateResult.success) {
//           throw new Error('Failed to create scrap inventory');
//         }
//       }
//     }

//     // Check if dust inventory exists
//     const dustInventoryQuery = await conn.query(
//       `SELECT Id, Available_weight__c FROM Inventory_ledger__c 
//        WHERE Item_Name__c = 'Dust' 
//        AND Purity__c = '91.7%'`
//     );

//     if (dustReceivedWeight > 0) {
//       if (dustInventoryQuery.records.length > 0) {
//         // Update existing dust inventory
//         const currentWeight = dustInventoryQuery.records[0].Available_weight__c || 0;
//         const dustUpdateResult = await conn.sobject('Inventory_ledger__c').update({
//           Id: dustInventoryQuery.records[0].Id,
//           Available_weight__c: currentWeight + dustReceivedWeight,
//           Last_Updated__c: formattedDate
//         });

//         if (!dustUpdateResult.success) {
//           throw new Error('Failed to update dust inventory');
//         }
//       } else {
//         // Create new dust inventory
//         const dustCreateResult = await conn.sobject('Inventory_ledger__c').create({
//           Name: 'Dust',
//           Item_Name__c: 'Dust',
//           Purity__c: casting.Required_Purity__c,
//           Available_weight__c: dustReceivedWeight,
//           Unit_of_Measure__c: 'Grams',
//           Last_Updated__c: formattedDate
//         });

//         if (!dustCreateResult.success) {
//           throw new Error('Failed to create dust inventory');
//         }
//       }
//     }

//     res.json({
//       success: true,
//       message: "Casting and inventory updated successfully",
//       data: {
//         castingNumber,
//         receivedDate: formattedDate,
//         receivedWeight,
//         castingLoss,
//         scrapReceivedWeight,
//         dustReceivedWeight,
//         ornamentWeight,
//         status: 'Finished'
//       }
//     });

//   } catch (error) {
//     console.error("Error updating casting:", error);
//     console.error("Full error details:", JSON.stringify(error, null, 2));
//     res.status(500).json({
//       success: false,
//       message: error.message || "Failed to update casting"
//     });
//   }
// });


/**-----------------Update Casting Received Weight ----------------- */
app.post("/api/casting/update/:date/:month/:year/:number", async (req, res) => {
  try {
    const { date, month, year, number } = req.params;
    const {
      receivedDate,
      receivedWeight,
      castingLoss,
      scrapReceivedWeight,
      dustReceivedWeight,
      ornamentWeight
    } = req.body;

    const castingNumber = `${date}/${month}/${year}/${number}`;
    const formattedDate = new Date(receivedDate).toISOString();

    const pool = await poolPromise;

    // 1. Check if casting exists
    const castingResult = await pool.request()
      .input("CastingNumber", sql.VarChar, castingNumber)
      .query("SELECT Id, Name, Required_Purity_c FROM Casting_dept__c WHERE Name= @CastingNumber");

    if (castingResult.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Casting not found"
      });
    }

    const casting = castingResult.recordset[0];
    const purity = casting.RequiredPurity || "91.7%"; // fallback

    // 2. Update casting
    await pool.request()
      .input("CastingNumber", sql.VarChar, castingNumber)
      .input("ReceivedDate", sql.DateTime, formattedDate)
      .input("ReceivedWeight", sql.Float, receivedWeight)
      .input("CastingLoss", sql.Float, castingLoss)
      .input("ScrapReceivedWeight", sql.Float, scrapReceivedWeight)
      .input("DustReceivedWeight", sql.Float, dustReceivedWeight)
      .input("OrnamentWeight", sql.Float, ornamentWeight)
      .input("Status", sql.VarChar, 'Finished')
      .query(`
        UPDATE Casting_dept__c
        SET 
          Received_Date_c = @ReceivedDate,
          Weight_Received_c = @ReceivedWeight,
          Casting_Loss_c = @CastingLoss,
          Casting_Scrap_Weight_c = @ScrapReceivedWeight,
          Casting_Dust_Weight_c = @DustReceivedWeight,
          Casting_Ornament_Weight_c= @OrnamentWeight,
          status_c = @Status
        WHERE Name = @CastingNumber
      `);

   // 3. Handle Scrap Inventory
if (scrapReceivedWeight > 0) {
  const scrapResult = await pool.request()
    .input("Purity", sql.VarChar, purity)
    .query("SELECT TOP 1 * FROM Inventory_ledger__c WHERE Item_Name_c = 'Scrap' AND Purity_c = @Purity");

  if (scrapResult.recordset.length > 0) {
    const scrapRecord = scrapResult.recordset[0];
    const scrapId = scrapRecord.Id;
    const currentWeight = scrapRecord.Available_Weight_c || 0;

    await pool.request() 
      .input("Id", sql.VarChar, scrapId) // Use VarChar if Id is a string
      .input("NewWeight", sql.Float, currentWeight + scrapReceivedWeight)
      .input("UpdatedDate", sql.DateTime, formattedDate)
      .query(`
        UPDATE Inventory_ledger__c
        SET Available_Weight_c = @NewWeight, Last_Updated_c = @UpdatedDate
        WHERE Id = @Id
      `);
  } else {
    await pool.request()
      .input("ItemName", sql.VarChar, 'Scrap')
      .input("Purity", sql.VarChar, purity)
      .input("AvailableWeight", sql.Float, scrapReceivedWeight)
      .input("Unit", sql.VarChar, 'Grams')
      .input("UpdatedDate", sql.DateTime, formattedDate)
      .query(`
        INSERT INTO Inventory_ledger__c 
          (Item_Name_c, Purity_c, Available_Weight_c, Unit_Of_Measure, Last_Updated_c)
        VALUES 
          (@ItemName, @Purity, @AvailableWeight, @Unit, @UpdatedDate)
      `);
  }
}

    // 4. Handle Dust Inventory
    if (dustReceivedWeight > 0) {
      const dust = await pool.request()
        .input("Purity", sql.VarChar, purity)
        .query("SELECT TOP 1 * FROM Inventory_ledger__c WHERE Item_Name_c = 'Dust' AND Purity_c = @Purity");

      if (dust.recordset.length > 0) {
        const currentWeight = dust.recordset[0].AvailableWeight || 0;
        await pool.request()
          .input("Id", sql.Int, dust.recordset[0].Id)
          .input("NewWeight", sql.Float, currentWeight + dustReceivedWeight)
          .input("UpdatedDate", sql.DateTime, formattedDate)
          .query(`
            UPDATE Inventory_ledger__c
            SET Available_Weight_c = @NewWeight,Last_Updated_c = @UpdatedDate
            WHERE Id = @Id
          `);
      } else {
        await pool.request()
          .input("ItemName", sql.VarChar, 'Dust')
          .input("Purity", sql.VarChar, purity)
          .input("AvailableWeight", sql.Float, dustReceivedWeight)
          .input("Unit", sql.VarChar, 'Grams')
          .input("UpdatedDate", sql.DateTime, formattedDate)
          .query(`
            INSERT INTO Inventory_ledger__c (Item_Name_c, Purity_c, Available_Weight_c, Unit_Of_Measure, Last_Updated_c)
            VALUES (@ItemName, @Purity, @AvailableWeight, @Unit, @UpdatedDate)
          `);
      }
    }

    res.json({
      success: true,
      message: "Casting and inventory updated successfully",
      data: {
        castingNumber,
        receivedDate: formattedDate,
        receivedWeight,
        castingLoss,
        scrapReceivedWeight,
        dustReceivedWeight,
        ornamentWeight,
        status: 'Finished'
      }
    });

  } catch (error) {
    console.error("Error updating casting:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to update casting"
    });
  }
});


// app.post("/api/filing/create", async (req, res) => {
//   try {
//     const { 
//       filingId,  
//       issuedWeight, 
//       issuedDate, 
//       pouches,
//       orderId,
//       name,
//       quantity,  
//     } = req.body;

//     console.log('Creating Filing record:', { 
//       filingId,  
//       issuedWeight, 
//       issuedDate 
//     });

//     // First create the Grinding record
//     const filingResult = await conn.sobject('Filing__c').create({
//       Name : filingId,
//       Issued_Weight__c: issuedWeight,
//       Issued_Date__c: issuedDate,
//       Order_Id__c:orderId,
//       Product__C : name,
//       Quantity__c : quantity,
//       Status__c: 'In progress'
//     });

//     console.log('Grinding creation result:', filingResult);

//     if (!filingResult.success) {
//       throw new Error('Failed to create filing record');
//     }

//     // Create WIP pouches
//     const pouchRecords = pouches.map(pouch => ({
//       Name: pouch.pouchId,
//       Filing__c: filingResult.id,
//       Order_Id__c: pouch.orderId,
//       Issued_Pouch_weight__c: pouch.weight,
//       Product__c :pouch.name,
//       Quantity__c:pouch.quantity
//     }));

//     console.log('Creating pouches:', pouchRecords);

//     const pouchResults = await conn.sobject('Pouch__c').create(pouchRecords);
//     console.log('Pouch creation results:', pouchResults);

//     // Add this section to create pouch items with clear logging
//     if (Array.isArray(pouchResults)) {
//       console.log('Starting pouch items creation...');
      
//       const pouchItemPromises = pouchResults.map(async (pouchResult, index) => {
//         console.log(`Processing pouch ${index + 1}:`, pouchResult);
        
//         if (pouches[index].categories && pouches[index].categories.length > 0) {
//           console.log(`Found ${pouches[index].categories.length} categories for pouch ${index + 1}`);
          
//           const pouchItemRecords = pouches[index].categories.map(category => {
//             const itemRecord = {
//               Name: category.category,
//               WIPPouch__c: pouchResult.id,
//               Category__c: category.category,
//               Quantity__c: category.quantity
//             };
//             console.log('Creating pouch item:', itemRecord);
//             return itemRecord;
//           });

//           try {
//             console.log(`Attempting to create ${pouchItemRecords.length} pouch items`);
//             const itemResults = await conn.sobject('Pouch_Items__c').create(pouchItemRecords);
            
//             if (Array.isArray(itemResults)) {
//               itemResults.forEach((result, i) => {
//                 if (result.success) {
//                   console.log(`Pouch item ${i + 1} created successfully:`, result);
//                 } else {
//                   console.error(`Pouch item ${i + 1} creation failed:`, result.errors);
//                 }
//               });
//             } else {
//               if (itemResults.success) {
//                 console.log('Single pouch item created successfully:', itemResults);
//               } else {
//                 console.error('Single pouch item creation failed:', itemResults.errors);
//               }
//             }
            
//             return itemResults;
//           } catch (error) {
//             console.error('Error in pouch items creation:', error.message);
//             console.error('Full error:', error);
//             throw error;
//           }
//         } else {
//           console.log(`No categories found for pouch ${index + 1}`);
//         }
//       });

//       console.log('Waiting for all pouch items to be created...');
//       const pouchItemResults = await Promise.all(pouchItemPromises);
//       console.log('All pouch items creation completed:', pouchItemResults);
//     }

//     res.json({
//       success: true,
//       message: "Grinding record created successfully",
//       data: {
//         filingId,
//         grindingRecordId: filingResult.id,
//         pouches: pouchResults
//       }
//     });

//   } catch (error) {
//     console.error("Error creating grinding record:", error);
//     console.error("Full error details:", JSON.stringify(error, null, 2));
//     res.status(500).json({
//       success: false,
//       message: error.message || "Failed to create grinding record"
//     });
//   }
// });


app.post("/api/filing/create", async (req, res) => {
  try {
    const {
      filingId,
      issuedWeight,
      issuedDate,
      pouches,
      orderId,
      name,
      quantity,
    } = req.body;

    console.log("Creating Filing record:", {
      filingId,
      issuedWeight,
      issuedDate,
    });

    const pool = await poolPromise;

    // 1. Insert Filing record
    const filingInsertResult = await pool.request()
      .input("Name", sql.VarChar, filingId)
      .input("IssuedWeight", sql.Float, issuedWeight)
      .input("IssuedDate", sql.DateTime, issuedDate)
      .input("OrderId", sql.VarChar, orderId)
      .input("Product", sql.VarChar, name)
      .input("Quantity", sql.Int, quantity)
      .input("Status", sql.VarChar, "In progress")
      .query(`
        INSERT INTO Filing__c (Name, Issued_Weight_c, Issued_Date_c, Order_Id_c, Product_c, Quantity_c, Status_c)
        OUTPUT INSERTED.Id
        VALUES (@Name, @IssuedWeight, @IssuedDate, @OrderId, @Product, @Quantity, @Status)
      `);

   
    const NexfilingId = filingInsertResult.recordset[0].Name;
  filingInsertResult.push({ filingRecordId: filingId });
    console.log("Filing Insert Result:Filing_C", NexfilingId);
    // 2. Insert Pouches
    const pouchResults = [];

    for (const pouch of pouches) {

     const pouchInsert = await pool.request()
  .input("Name", sql.VarChar, pouch.pouchId)
  .input("FilingId", sql.Int, filingRecordId)
  .input("OrderId", sql.VarChar, pouch.orderId)
  .input("Weight", sql.Float, pouch.weight)
  .input("Product", sql.VarChar, pouch.name)
  .input("Quantity", sql.Int, pouch.quantity)
  .query(`
    INSERT INTO Pouch__c (
      Name, Filing_c, Order_Id_c,
      Issued_Pouch_weight_c, Product_c, Quantity_c
    )
    OUTPUT INSERTED.Id
    VALUES (@Name, @FilingId, @OrderId, @Weight, @Product, @Quantity)
  `);

        console.log("Pouch Insert Result: Filing_C", filingRecordId);
      const pouchId = pouchInsert.recordset[0].Id;
      pouchResults.push({ pouchRecordId: pouchId });

      // 3. Insert Pouch Items for each pouch
      if (Array.isArray(pouch.categories) && pouch.categories.length > 0) {
        for (const category of pouch.categories) {
          await pool.request()
            .input("Name", sql.VarChar, category.category)
            .input("PouchId", sql.Int, pouchId)
            .input("Category", sql.VarChar, category.category)
            .input("Quantity", sql.Int, category.quantity)
            .query(`
              INSERT INTO Pouch_Items__c (Name, WIPPouch__c, Category__c, Quantity__c)
              VALUES (@Name, @PouchId, @Category, @Quantity)
            `);
        }
      }
    }

    res.json({
      success: true,
      message: "Filing record and related pouches/items created successfully",
      data: {
        filingId,
        filingRecordId,
        pouches: pouchResults
      }
    });
  } catch (error) {
    console.error("Error creating filing record:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to create filing record"
    });
  }
});



// app.post("/api/filing/update/:prefix/:date/:month/:year/:number/:numb", async (req, res) => {
//   try {
//     const { prefix, date, month, year, number, numb } = req.params;
//     const { receivedDate, receivedWeight, grindingLoss, scrapReceivedWeight, dustReceivedWeight, ornamentWeight, pouches } = req.body;
//     const filingNumber = `${prefix}/${date}/${month}/${year}/${number}/${numb}`;
//     const formattedDate = new Date(receivedDate).toISOString();

//     const pool = await poolPromise;

//     // Check if filing record exists
//     const filingQuery = await pool.request()
//       .input("filingNumber", sql.VarChar, filingNumber)
//       .query("SELECT TOP 1 * FROM Filing__c WHERE Name = @filingNumber");

//     if (filingQuery.recordset.length === 0) {
//       return res.status(404).json({
//         success: false,
//         message: "Filing record not found"
//       });
//     }

//     const filing = filingQuery.recordset[0];

//     // Update the filing record
//     await pool.request()
//       .input("receivedDate", sql.DateTime, formattedDate)
//       .input("receivedWeight", sql.Decimal(18, 2), receivedWeight)
//       .input("grindingLoss", sql.Decimal(18, 2), grindingLoss)
//       .input("scrapWeight", sql.Decimal(18, 2), scrapReceivedWeight)
//       .input("dustWeight", sql.Decimal(18, 2), dustReceivedWeight)
//       .input("ornamentWeight", sql.Decimal(18, 2), ornamentWeight)
//       .input("status", sql.VarChar, "Finished")
//       .input("filingId", sql.Int, filing.Id)
//       .query(`
//         UPDATE Filing__c SET 
//           Received_Date_c = @receivedDate,
//           Receievd_weight_c = @receivedWeight,
//           Filing_loss_c = @grindingLoss,
//           Filing_Scrap_Weight_c = @scrapWeight,
//           Filing_Dust_Weight_c = @dustWeight,
//           Filing_Ornament_Weight_c = @ornamentWeight,
//           Status_c = @status
//         WHERE Id = @filingId
//       `);

//     // Update each pouch weight
//     if (Array.isArray(pouches) && pouches.length > 0) {
//       for (const pouch of pouches) {
//         await pool.request()
//           .input("pouchId", sql.Int, pouch.pouchId)
//           .input("receivedWeight", sql.Decimal(18, 2), pouch.receivedWeight)
//           .input("grindingLoss", sql.Decimal(18, 2), grindingLoss)
//           .query(`
//             UPDATE Pouch__c SET 
//               Received_Pouch_weight_c = @receivedWeight,
//               Filing_loss_Pouch_c = @grindingLoss
//             WHERE Id = @pouchId
//           `);
//       }
//     }

//     // 🧾 Scrap Inventory Handling
//     if (scrapReceivedWeight > 0) {
//       const scrapQuery = await pool.request()
//         .query(`SELECT TOP 1 * FROM Inventory_Ledger__c WHERE Item_Name_c = 'Scrap' AND Purity = '91.7%'`);

//       if (scrapQuery.recordset.length > 0) {
//         const currentWeight = scrapQuery.recordset[0].Available_weight || 0;
//         await pool.request()
//           .input("newWeight", sql.Decimal(18, 2), currentWeight + scrapReceivedWeight)
//           .input("lastUpdated", sql.DateTime, formattedDate)
//           .input("id", sql.Int, scrapQuery.recordset[0].Id)
//           .query(`
//             UPDATE Inventory_Ledger__c SET 
//               Available_weight_c = @newWeight,
//               Last_Updated_c = @lastUpdated 
//             WHERE Id = @id
//           `);
//       } else {
//         await pool.request()
//           .input("name", sql.VarChar, "Scrap")
//           .input("item", sql.VarChar, "Scrap")
//           .input("purity", sql.VarChar, filing.Required_Purity)
//           .input("weight", sql.Decimal(18, 2), scrapReceivedWeight)
//           .input("unit", sql.VarChar, "Grams")
//           .input("lastUpdated", sql.DateTime, formattedDate)
//           .query(`
//             INSERT INTO Inventory_Ledger__c 
//             (Name, Item_Name_c, Purity_c, Available_weight_c, Unit_of_Measure_c, Last_Updated_c)
//             VALUES (@name, @item, @purity, @weight, @unit, @lastUpdated)
//           `);
//       }
//     }

//     // 🧾 Dust Inventory Handling
//     if (dustReceivedWeight > 0) {
//       const dustQuery = await pool.request()
//         .query(`SELECT TOP 1 * FROM Inventory_Ledger__c WHERE Item_Name_c = 'Dust' AND Purity = '91.7%'`);

//       if (dustQuery.recordset.length > 0) {
//         const currentWeight = dustQuery.recordset[0].Available_weight || 0;
//         await pool.request()
//           .input("newWeight", sql.Decimal(18, 2), currentWeight + dustReceivedWeight)
//           .input("lastUpdated", sql.DateTime, formattedDate)
//           .input("id", sql.Int, dustQuery.recordset[0].Id)
//           .query(`
//             UPDATE Inventory_Ledger__c SET 
//               Available_weight_c = @newWeight,
//               Last_Updated_c = @lastUpdated 
//             WHERE Id = @id
//           `);
//       } else {
//         await pool.request()
//           .input("name", sql.VarChar, "Dust")
//           .input("item", sql.VarChar, "Dust")
//           .input("purity", sql.VarChar, filing.Required_Purity)
//           .input("weight", sql.Decimal(18, 2), dustReceivedWeight)
//           .input("unit", sql.VarChar, "Grams")
//           .input("lastUpdated", sql.DateTime, formattedDate)
//           .query(`
//             INSERT INTO Inventory_Ledger__c 
//             (Name, Item_Name_c, Purity_c, Available_weight_c, Unit_of_Measure_c, Last_Updated_c)
//             VALUES (@name, @item, @purity, @weight, @unit, @lastUpdated)
//           `);
//       }
//     }

//     res.json({
//       success: true,
//       message: "Filing and inventory updated successfully",
//       data: {
//         filingNumber,
//         receivedDate: formattedDate,
//         receivedWeight,
//         grindingLoss,
//         scrapReceivedWeight,
//         dustReceivedWeight,
//         ornamentWeight,
//         status: 'Finished'
//       }
//     });

//   } catch (error) {
//     console.error("Error updating filing:", error);
//     res.status(500).json({
//       success: false,
//       message: error.message || "Failed to update filing"
//     });
//   }
// });

 
app.post("/api/polishing/create", async (req, res) => {
  try {
    const {
      polishingId,
      issuedDate,
      pouches,
      totalWeight,
      status,
      product,
      quantity,
      orderId
    } = req.body;

    console.log('[Polishing Create] Received data:', {
      polishingId,
      issuedDate,
      pouchCount: pouches.length,
      totalWeight,
      status,
      product,
      quantity
    });

    const pool = await poolPromise;

    // 1. Insert Polishing__c record
    const insertPolishing = await pool.request()
      .input("Name", sql.VarChar, polishingId)
      .input("IssuedDate", sql.DateTime, issuedDate)
      .input("IssuedWeight", sql.Float, totalWeight)
      .input("Status", sql.VarChar, status)
      .input("Product", sql.VarChar, product)
      .input("Quantity", sql.Int, quantity)
      .input("OrderId", sql.VarChar, orderId)
      .query(`
        INSERT INTO Polishing__c (Name, Issued_Date_c, Issued_Weight_c, Status_c, Product_c, Quantity_c, Order_Id_c)
        OUTPUT INSERTED.Id
        VALUES (@Name, @IssuedDate, @IssuedWeight, @Status, @Product, @Quantity, @OrderId)
      `);

    const polishingRecordId = insertPolishing.recordset[0].Id;

    console.log('[Polishing Create] Polishing record created with Id:', polishingRecordId);

    // 2. Update each pouch in Pouch__c
    const pouchResults = [];

    for (const pouch of pouches) {
      console.log('[Polishing Create] Updating pouch:', {
        pouchId: pouch.pouchId,
        weight: pouch.polishingWeight
      });

      const updatePouch = await pool.request()
        .input("PouchId", sql.Int, pouch.pouchId)
        .input("PolishingId", sql.Int, polishingRecordId)
        .input("IssuedWeightPolishing", sql.Float, pouch.polishingWeight)
        .input("Product", sql.VarChar, product)
        .input("Quantity", sql.Int, quantity)
        .query(`
          UPDATE Pouch__c
          SET Polishing_c = @PolishingId,
              Issued_Weight_Polishing_c = @IssuedWeightPolishing,
              Product_c = @Product,
              Quantity_c = @Quantity
          WHERE Id = @PouchId
        `);

      pouchResults.push({
        pouchId: pouch.pouchId,
        updated: true
      });
    }

    res.json({
      success: true,
      message: "Polishing record created successfully",
      data: {
        polishingId: polishingId,
        polishingRecordId: polishingRecordId,
        pouches: pouchResults
      }
    });

  } catch (error) {
    console.error("[Polishing Create] Error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to create polishing record"
    });
  }
}); 


/**-----------------Update Polishing Received Weight ----------------- */
// app.post("/api/polishing/update/:prefix/:date/:month/:year/:number/:subnumber", async (req, res) => {
//   try {
//     const { prefix, date, month, year, number, subnumber } = req.params;
//     const { receivedDate, receivedWeight, polishingLoss, scrapReceivedWeight, dustReceivedWeight, ornamentWeight, pouches } = req.body;
//     const polishingNumber = `${prefix}/${date}/${month}/${year}/${number}/${subnumber}`;
//     const pool = await poolPromise;

//     console.log('[Polishing Update] Received data:', {
//       polishingNumber, receivedDate, receivedWeight, polishingLoss, pouches
//     });

//     // 1. Get polishing record
//     const polishingResult = await pool.request()
//       .input('Name', sql.VarChar, polishingNumber)
//       .query(`SELECT TOP 1 * FROM Polishing__c WHERE Name = @Name`);

//     if (polishingResult.recordset.length === 0) {
//       return res.status(404).json({ success: false, message: "Polishing record not found" });
//     }

//     const polishing = polishingResult.recordset[0];

//     // 2. Update polishing record
//     await pool.request()
//       .input('Id', sql.Int, polishing.Id)
//       .input('Received_Date_c', sql.DateTime, receivedDate)
//       .input('Received_Weight_c', sql.Decimal(18, 3), receivedWeight)
//       .input('Polishing_loss_c', sql.Decimal(18, 3), polishingLoss)
//       .input('Polishing_Scrap_Weight_c', sql.Decimal(18, 3), scrapReceivedWeight)
//       .input('Polishing_Dust_Weight_c', sql.Decimal(18, 3), dustReceivedWeight)
//       .input('Polishing_Ornament_Weight_c', sql.Decimal(18, 3), ornamentWeight)
//       .input('Status_c', sql.VarChar, 'Finished')
//       .query(`
//         UPDATE Polishing__c SET 
//           Received_Date_c = @Received_Date__c,
//           Received_Weight_c = @Received_Weight__c,
//           Polishing_loss_c = @Polishing_loss__c,
//           Polishing_Scrap_Weight_c = @Polishing_Scrap_Weight__c,
//           Polishing_Dust_Weight_c = @Polishing_Dust_Weight__c,
//           Polishing_Ornament_Weight_c = @Polishing_Ornament_Weight__c,
//           Status__c = @Status_c
//         WHERE Id = @Id
//       `);

//     // 3. Update each pouch (if provided)
//     if (pouches && pouches.length > 0) {
//       for (const pouch of pouches) {
//         await pool.request()
//           .input('Id', sql.Int, pouch.pouchId)
//           .input('Received_Weight_Polishing__c', sql.Decimal(18, 3), pouch.receivedWeight)
//           .input('Polishing_Loss_c', sql.Decimal(18, 3), polishingLoss)
//           .query(`
//             UPDATE Pouch__c SET 
//               Received_Weight_Polishing_c = @Received_Weight_Polishing__c,
//               Polishing_Loss_c = @Polishing_Loss__c
//             WHERE Id = @Id
//           `);
//       }
//     }

//     // 4. Update or insert Scrap Inventory
//     if (scrapReceivedWeight > 0) {
//       const scrapInv = await pool.request()
//         .query(`SELECT TOP 1 * FROM Inventory_ledger__c WHERE Item_Name__c = 'Scrap' AND Purity__c = '91.7%'`);

//       if (scrapInv.recordset.length > 0) {
//         const existing = scrapInv.recordset[0];
//         await pool.request()
//           .input('Id', sql.Int, existing.Id)
//           .input('NewWeight', sql.Decimal(18, 3), existing.Available_weight__c + scrapReceivedWeight)
//           .input('Last_Updated__c', sql.DateTime, receivedDate)
//           .query(`
//             UPDATE Inventory_ledger__c 
//             SET Available_weight_c = @NewWeight, Last_Updated_c = @Last_Updated__c 
//             WHERE Id = @Id
//           `);
//       } else {
//         await pool.request()
//           .input('Name', sql.VarChar, 'Scrap')
//           .input('Item_Name__c', sql.VarChar, 'Scrap')
//           .input('Purity__c', sql.VarChar, polishing.Purity__c)
//           .input('Available_weight__c', sql.Decimal(18, 3), scrapReceivedWeight)
//           .input('Unit_of_Measure__c', sql.VarChar, 'Grams')
//           .input('Last_Updated__c', sql.DateTime, receivedDate)
//           .query(`
//             INSERT INTO Inventory_ledger__c 
//               (Name, Item_Name_c, Purity_c, Available_weight_c, Unit_of_Measure_c, Last_Updated_c)
//             VALUES 
//               (@Name, @Item_Name__c, @Purity__c, @Available_weight__c, @Unit_of_Measure__c, @Last_Updated__c)
//           `);
//       }
//     }

//     // 5. Update or insert Dust Inventory
//     if (dustReceivedWeight > 0) {
//       const dustInv = await pool.request()
//         .query(`SELECT TOP 1 * FROM Inventory_ledger__c WHERE Item_Name_c = 'Dust' AND Purity__c = '91.7%'`);

//       if (dustInv.recordset.length > 0) {
//         const existing = dustInv.recordset[0];
//         await pool.request()
//           .input('Id', sql.Int, existing.Id)
//           .input('NewWeight', sql.Decimal(18, 3), existing.Available_weight__c + dustReceivedWeight)
//           .input('Last_Updated__c', sql.DateTime, receivedDate)
//           .query(`
//             UPDATE Inventory_ledger__c 
//             SET Available_weight_c = @NewWeight, Last_Updated_c = @Last_Updated__c 
//             WHERE Id = @Id
//           `);
//       } else {
//         await pool.request()
//           .input('Name', sql.VarChar, 'Dust')
//           .input('Item_Name__c', sql.VarChar, 'Dust')
//           .input('Purity__c', sql.VarChar, polishing.Purity__c)
//           .input('Available_weight__c', sql.Decimal(18, 3), dustReceivedWeight)
//           .input('Unit_of_Measure__c', sql.VarChar, 'Grams')
//           .input('Last_Updated__c', sql.DateTime, receivedDate)
//           .query(`
//             INSERT INTO Inventory_ledger__c 
//               (Name, Item_Name_c, Purity_c, Available_weight_c, Unit_of_Measure_c, Last_Updated_c)
//             VALUES 
//               (@Name, @Item_Name__c, @Purity__c, @Available_weight__c, @Unit_of_Measure__c, @Last_Updated__c)
//           `);
//       }
//     }

//     res.json({
//       success: true,
//       message: "Polishing record updated successfully",
//       data: {
//         polishingNumber,
//         receivedDate,
//         receivedWeight,
//         polishingLoss,
//         status: 'Finished'
//       }
//     });

//   } catch (error) {
//     console.error("[Polishing Update] Error:", error);
//     res.status(500).json({
//       success: false,
//       message: error.message || "Failed to update polishing record"
//     });
//   }
// });



//-------------------------------------------------------------------------------Get  Calls------------------------------------------------------------------------------------------------------------

app.get("/api/data", async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .query("SELECT TOP 10 * FROM CustomUser__c"); // Replace with your query

    res.json({
      success: true,
      data: result.recordset
    });
  } catch (err) {
    console.error("SQL error", err);
    res.status(500).json({ success: false, message: "SQL error", error: err });
  }
});


// Required imports








/** ----------------- Item Groups Management ------------------ **/

// Create Item Group

//order_id

app.get("/OrderIDNumber", checkMssqlConnection, async (req, res) => {
  try {
    const pool = req.mssql;

    const query = `
      SELECT Id, Order_Id_c 
      FROM Order__c
      ORDER BY Order_Id_c
    `;

    const result = await pool.request().query(query);
    console.log("Query result:", result); // <---- Debug output

    if (result.recordset.length === 0) {
      return res.status(404).json({ success: false, message: "No orders found." });
    }

    res.json({ success: true, data: result.recordset }); // <--- Ensure you're returning data
  } catch (error) {
    console.error("❌ SQL Error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});




/** ----------------- Product Groups Management ------------------ **/

// Create Product Group

// Fetch Product Groups
app.get("/product-groups", checkSalesforceConnection, async (req, res) => {
  try {
    const pool = req.mssql;
    const result = await pool.request().query(`SELECT Id, ProductGroupName_c
      FROM Product_Group__c
      ORDER BY ProductGroupName_c`); // Adjust table name

    res.json({ success: true, data: result.recordset });
  } catch (err) {
    console.error("Error in /product-groups:", err);  // Log exact error
    res.status(500).json({ success: false, error: err.message || "Unknown error" });
  }
});


/** ----------------- Size Groups Management ------------------ **/




// Fetch Size Groups
app.get("/size-groups", checkSalesforceConnection, async (req, res) => {
  try {
    const pool = req.mssql;
    const query = `
      SELECT Id, Size__c
      FROM jewlerySize__c
      ORDER BY Size__c
    `;
    const result = await pool.request().query(query);

    if (result.recordset.length === 0) {
      return res.status(404).json({ success: false, message: "No size groups found." });
    }

    res.json({ success: true, data: result.recordset });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});



/** ----------------- Jewelry Model Management ------------------ **/



// Fetch jewelry models with an optional category filter
app.get("/api/jewelry-models", checkMssqlConnection , async (req, res) => {
  try {
    console.log("Fetching jewelry models...");
    const pool = req.mssql;
    const { Category } = req.query;

    // First get the jewelry models
    let jewelryQuery = `
      SELECT Id, Name, Category_c, Material_c, Style_c, Color_c, Purity_c, 
             Master_Weight_c, Net_Weight_c, Stone_Weight_c, Rate_c, Image_URL_c, Size_c,Gross_Weight_c
      FROM Jewlery_Model__c
    `;

    if (Category) {
      jewelryQuery += ` WHERE Category_c = '${Category}'`;
    }
    jewelryQuery += ` ORDER BY Name`;

    const result =  await pool.request().query(jewelryQuery);

    if (result.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No jewelry models found.",
      });
    }
    
    // Format the response data and pass the image URLs directly
    const responseData = result.recordset.map((model) => ({
      Id: model.Id,
      Name: model.Name,
      Category: model.Category_c,
      Material: model.Material_c,
      Style: model.Style_c,
      Color: model.Color_c,
      Purity: model.Purity_c,
      MasterWeight: model.Master_Weight_c,
      NetWeight: model.Net_Weight__c,
      StoneWeight: model.Stone_Weight_c,
      Rate: model.Rate_c,
      GrossWeight: model.Gross_Weight_c,
      Size :model.Size_c	,
      
      // Pass through the full distribution URL
      ImageURL: model.Image_URL_c || null
    }));

    console.log(responseData);

    res.status(200).json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    console.error("Error fetching jewelry models:", error.message);
    res.status(500).json({
      success: false,
      message: "An unexpected error occurred.",
      error: error.message,
    });
  }
});

// Fetch customer Groups
// app.get("/customer-groups", checkSalesforceConnection, async (req, res) => {
//   try {
//     const pool = req.mssql;
//     const query = `
//       SELECT Id,Party_Code_c
//       FROM Party_Ledger__c
//       ORDER BY Party_Code_c
//     `;
//     const result = await pool.request().query(query);

//     if (result.recordset.length === 0) {
//       return res.status(404).json({ success: false, message: "No customer groups found." });
//     }

//     res.json({ success: true, data: result.recordset });
//   } catch (error) {
//     res.status(500).json({ success: false, error: error.message });
//   }
// });




async function uploadFileToSalesforce(file) {
  try {
      const fileData = file.buffer;
      const fileName = `Order_${Date.now()}.pdf`;

      // Create ContentVersion
      const contentVersion = await conn.sobject('ContentVersion').create({
          Title: fileName,
          PathOnClient: fileName,
          VersionData: fileData.toString('base64'),
          IsMajorVersion: true
      });

      // Get ContentDocumentId
      const versionDetails = await conn.sobject('ContentVersion')
          .select('Id, ContentDocumentId')
          .where({ Id: contentVersion.id })
          .execute();

      return {
          id: contentVersion.id,
          contentDocumentId: versionDetails[0].ContentDocumentId
      };
  } catch (error) {
      console.error('Error uploading to Salesforce:', error);
      throw error;
  }
}

/*-------Fetch order number----------------------------------------------------------------------------------------------------------------------Pass partyLedgerValue-----*/

app.get('/api/getLastOrderNumber', checkSalesforceConnection, async (req, res) => {
  const { partyLedgerValue } = req.query;

   const pool = req.mssql;

   console.log("paarty code:", partyLedgerValue)

  if (!partyLedgerValue) {
      return res.status(400).json({
          success: false,
          message: 'partyLedgerValue is required'
      });
  }

  try {
      // Query to fetch the latest order for the given PartyLedger
      const query = 
      // `
      //     SELECT Order_Id_c 
      //     FROM Order__c
      //     WHERE Party_Ledger_c IN (
      //         SELECT Id 
      //         FROM Party_Ledger__c 
      //         WHERE Party_Code_c = '${partyLedgerValue}'
      //     )
      //     ORDER BY CreatedDate DESC               
      //     `
      
          ` SELECT Order_Id_c 
          FROM Order__c
          WHERE Party_code_c = '${partyLedgerValue}'
          
          ORDER BY id DESC`


      ;


     const result = await pool.request().query(query);
      console.log('Query result:', result); // Debug log

      if (result.recordset.length === 0) {
          // No previous orders found, return null to let frontend start from 0001
          return res.json({
              success: true,
              lastOrderNumber: null  // Changed from '${partyLedgerValue}/0000'
          });
      }

      const lastOrderNumber = result.recordset[0].Order_Id_c;
      console.log('Last order number:', lastOrderNumber); // Debug log

      res.json({
          success: true,
          lastOrderNumber
      });

  } catch (error) {
      console.error('Salesforce Query Error:', error);
      res.status(500).json({
          success: false,
          message: 'Error fetching order number',
          error: error.message
      });
  }
});

/*------------------Order Mangement----------*/




// Proxy Endpoint for Fetching PDFs
app.get("/api/download-file", async (req, res) => {
  try {
  const pool = req.mssql;

    const fileUrl = req.query.url;
    console.log("File URL:", fileUrl); // Log the URL for debugging
    if (!fileUrl) {
      return res.status(400).json({ success: false, error: "File URL is required" });
    }

    const response = await axios.get(fileUrl, {
      headers: {
        "Authorization": `Bearer ${process.env.SALESFORCE_ACCESS_TOKEN}`, // Ensure you have a valid token
      },
      responseType: 'stream', // Important for streaming the response
    });

    // Set headers and stream the file to the frontend
    res.setHeader("Content-Type", response.headers['content-type']);
    res.setHeader("Content-Disposition", response.headers['content-disposition']);
    response.data.pipe(res);

  } catch (error) {
    console.error("Error fetching file:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});




/**------------Order and model fetching----------------- */
// app.get("/api/order-details", async (req, res) => {
//   try {
//      const pool = req.mssql;  

//     const orderId = req.query.orderId;

//     if (!orderId) {
//       return res.status(400).json({
//         success: false,
//         message: "Order ID is required"
//       });
//     }

//     // First, get the order details
//     const orderQuery = `
//       SELECT 
//         Id,
//         Order_Id_c,
//         Party_Name_c,
//         Delivery_Date_c,
//         Advance_Metal_c,
//         Status_c,
//         Purity_c,
//         Remarks_c,
//         Created_By_c,
//         Created_Date_c,
//         Pdf_c
//       FROM Order__c
//       WHERE Order_Id_c = '${orderId}'
//       LIMIT 1
//     `;

//     const orderResult =  await pool.request().query(orderQuery);

//     if (!orderResult.recordset || orderResult.recordset.length === 0) {
//       return res.status(404).json({
//         success: false,
//         message: "Order not found"
//       });
//     }

//     const orderDetails = orderResult.recordset[0];

//     // Get regular models
//     const modelsQuery = `
//       SELECT 
//         Id,
//         Name,
//         Category_c,
//         Purity_c,
//         Size_c,
//         Color_c,
//         Quantity_c,
//         Gross_Weight_c,
//         Stone_Weight_c,
//         Net_Weight_c,
//         Batch_No_c,
//         Tree_No_c,
//         Remarks_c,
//         Order_sheet_c,
//         Order_Image_sheet_c,
//         Order_c
//       FROM Order_Models__c
//       WHERE Order_c = '${orderDetails.Id}'
//     `;

//     // Get canceled models
//     const canceledModelsQuery = `
//       SELECT 
//         Id,
//         Name,
//         Category_c,
//         Purity_c,
//         Size_c,
//         Color_c,
//         Quantity_c,
//         Gross_Weight_c,
//         Stone_Weight_c,
//         Net_Weight_c,
//         Batch_No_c,
//         Tree_No_c,
//         Remarks_c,
//         Order_sheet_c,
//         Order_Image_sheet_c,
//         Order_c
//       FROM Order_Models_Canceled__c
//       WHERE Order__c = '${orderDetails.Id}'
//     `;

//     // Execute both queries in parallel
//     const [modelsResult, canceledModelsResult] = await Promise.all([
//       conn.query(modelsQuery),
//       conn.query(canceledModelsQuery)
//     ]);

//     // Format the response
//     const response = {
//       orderDetails: {
//         orderId: orderDetails.Order_Id_c,
//         partyName: orderDetails.Party_Name_c,
//         deliveryDate: orderDetails.Delivery_Date_c,
//         advanceMetal: orderDetails.Advance_Metal_c,
//         status: orderDetails.Status_c,
//         purity: orderDetails.Purity_c,
//         remarks: orderDetails.Remarks_c,
//         createdBy: orderDetails.Created_By_c,
//         createdDate: orderDetails.Created_Date_c,
//         pdf: orderDetails.Pdf_c
//       },
//       regularModels: modelsResult.recordset.map(model => ({
//         id: model.Id,
//         name: model.Name,
//         category: model.Category_c,
//         purity: model.Purity_c,
//         size: model.Size_c,
//         color: model.Color_c,
//         quantity: model.Quantity_c,
//         grossWeight: model.Gross_Weight_c,
//         stoneWeight: model.Stone_Weight_c,
//         netWeight: model.Net_Weight_c,
//         batchNo: model.Batch_No_c,
//         treeNo: model.Tree_No_c,
//         remarks: model.Remarks_c,
//         orderSheet: model.Order_sheet_c,
//         orderImageSheet: model.Order_Image_sheet_c
//       })),
//       canceledModels: canceledModelsResult.recordset.map(model => ({
//         id: model.Id,
//         name: model.Name,
//         category: model.Category_c,
//         purity: model.Purity_c,
//         size: model.Size_c,
//         color: model.Color_c,
//         quantity: model.Quantity_c,
//         grossWeight: model.Gross_Weight_c,
//         stoneWeight: model.Stone_Weight_c,
//         netWeight: model.Net_Weight_c,
//         batchNo: model.Batch_No_c,
//         treeNo: model.Tree_No_c,
//         remarks: model.Remarks_c,
//         orderSheet: model.Order_sheet_c,
//         orderImageSheet: model.Order_Image_sheet_c,
//       }))
//     };

//     res.json({
//       success: true,
//       data: response
//     });

//   } catch (error) {
//     console.error("Error fetching order details:", error);
//     res.status(500).json({
//       success: false,
//       message: error.message || "Failed to fetch order details"
//     });
//   }
// });


// app.get("/get-inventory", checkMssqlConnection ,async (req, res) => {
//   try {
//     const pool = req.mssql;
//     // Query to fetch inventory items with their names and available weights

//     const query = `
//      SELECT 
//         Name,
//         Item_Name_c,
//         Available_weight_c,
//         Purity_c
//       FROM Inventory_ledger__c
//       ORDER BY Name ASC
//     `;

//    const result = await pool.request().query(query);

//     if (!result.recordset) {
//       return res.status(404).json({
//         success: false,
//         message: "No inventory items found"
//       });
//     }

//     // Format the response data
//     const inventoryItems = result.recordset.map(item => ({
//       name: item.Item_Name_c,
//       availableWeight: item.Available_weight_c,
//       purity: item.Purity_c
//     }));

//     res.status(200).json({
//       success: true,
//       message: "Inventory items fetched successfully",
//       data: inventoryItems
//     });

//   } catch (error) {
//     console.error("Error fetching inventory:", error);
//     res.status(500).json({
//       success: false,
//       message: error.message || "Failed to fetch inventory items"
//     });
//   }
// });

/**--------------------------Casting Management---------- **/

// app.post("/api/casting", async (req, res) => {
//   try {
//     const {
//       castingNumber,
//       date,
//       orders,
//       waxTreeWeight,
//       purity,
//       calculatedWeight,
//       purityPercentages,
//       requiredMetals,
//       issuedItems,
//       totalIssued
//     } = req.body;

//     // Validate
//     if (!castingNumber || !date || !orders || orders.length === 0) {
//       return res.status(400).json({ success: false, message: "Required fields are missing" });
//     }

//     // Parse date safely
//    let formattedDate = null;

// if (typeof date === "string") {
//   // Check for dd/MM/yyyy format
//   if (date.includes("/")) {
//     const [dd, mm, yyyy] = date.split("/");
//     if (dd && mm && yyyy) {
//       // Create ISO-style string to avoid browser inconsistencies
//       const isoString = `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
//       formattedDate = new Date(isoString);
//     }
//   } else {
//     // Try to parse directly for ISO or RFC strings
//     formattedDate = new Date(date.trim());
//   }
// } else if (date instanceof Date) {
//   formattedDate = date;
// }

// // Final validation
// if (!formattedDate || isNaN(formattedDate.getTime())) {
//   throw new Error("Invalid date format");
// }

//     const pool = await poolPromise;

//     // 1. Insert into Casting_dept__c
//     const castingInsert = await pool.request()
//       .input("castingNumber", sql.NVarChar, castingNumber)
//       .input("issuedDate", sql.DateTime, formattedDate)
//       .input("waxTreeWeight", sql.Decimal(18, 3), waxTreeWeight)
//       .input("purity", sql.NVarChar, purity)
//       .input("calculatedWeight", sql.Decimal(18, 3), calculatedWeight)
//       .input("requiredPure", sql.Decimal(18, 3), requiredMetals.pureGold)
//       .input("requiredAlloy", sql.Decimal(18, 3), requiredMetals.alloy)
//       .input("totalIssued", sql.Decimal(18, 3), totalIssued)
//       .input("status", sql.NVarChar, "Open")
//       .query(`
//         INSERT INTO Casting_dept__c 
//         (Name, Issued_Date_c, Wax_Tree_Weight_c, Required_Purity_c, Gold_Tree_Weight_c,
//          Required_Pure_Metal_Casting_c, Required_Alloy_for_Casting_c, Issud_weight_c, status_c)
//         OUTPUT INSERTED.Id
//         VALUES (@castingNumber, @issuedDate, @waxTreeWeight, @purity, @calculatedWeight,
//                 @requiredPure, @requiredAlloy, @totalIssued, @status)
//       `);

//     const castingId = castingInsert.recordset[0].Id;

//     // 2. Update Orders
//     const orderIdStr = orders.map(o => `'${o}'`).join(",");
//     const orderQuery = await pool.request().query(
//       `SELECT Id, Order_Id_c FROM Order__c WHERE Order_Id_c IN (${orderIdStr})`
//     );

//     if (orderQuery.recordset.length !== orders.length) {
//       throw new Error("Some orders were not found");
//     }

//     // Update each order
//     for (const order of orderQuery.recordset) {
//       await pool.request()
//         .input("id", sql.NVarChar, order.Id)
//         .input("castingId", sql.NVarChar, castingId)
//         .input("castingNumber", sql.NVarChar, castingNumber)
//         .query(`
//           UPDATE Order__c
//           SET Casting_c = @castingId,
//               Casting_Id_c = @castingNumber
//           WHERE Id = @id
//         `);
//     }

//     // 3. Insert Issued Inventory Records
//     for (const item of issuedItems) {
//       await pool.request()
//         .input("castingId", sql.NVarChar, castingId)
//         .input("itemName", sql.NVarChar, item.itemName)
//         .input("issuedDate", sql.DateTime, formattedDate)
//         .input("purity", sql.NVarChar, item.purity)
//         .input("issueWeight", sql.Decimal(18, 3), item.issueWeight)
//         .input("issuedGold", sql.Decimal(18, 3), item.issuedGold)
//         .input("issuedAlloy", sql.Decimal(18, 3), item.issuedAlloy)
//         .query(`
//           INSERT INTO Issued_inventory__c 
//           (Casting_c, Name, Issued_Date_c, Purity_c, Issue_Weight_c, 
//            Pure_Metal_weight_c, Alloy_Weight_c)
//           VALUES 
//           (@castingId, @itemName, @issuedDate, @purity, @issueWeight, @issuedGold, @issuedAlloy)
//         `);
//     }

//     // ✅ Response
//     res.json({
//       success: true,
//       message: "Casting process completed successfully",
//       data: {
//         castingId,
//         castingNumber,
//         totalIssuedWeight: totalIssued
//       }
//     });

//   } catch (error) {
//     console.error("Casting error:", error);
//     res.status(500).json({
//       success: false,
//       message: error.message || "Failed to complete casting process"
//     });
//   }
// });


// app.get("/api/casting", checkSalesforceConnection, async (req, res) => {
//   try {
//     const pool = req.mssql;

//     const query = `
//       SELECT 
//         Name,
//         Issud_weight_c AS Issued_weight,
//         Weight_Received_c AS Received_Weight,
//         Issued_Date_c AS Issued_Date,
//         Received_Date_c AS Received_Date,
//         status_c AS status,
//         Casting_Loss_c AS Casting_Loss,
//         Casting_Scrap_Weight_c AS Scrap_Weight,
//         Casting_Dust_Weight_c AS Dust_Weight,
//         Casting_Ornament_Weight_c AS Ornament_Weight
//       FROM Casting_dept__c
//     `;

//     const result = await pool.request().query(query);

//     res.json({ success: true, data: result.recordset });

//   } catch (error) {
//     console.error("❌ Error fetching casting data from MSSQL:", error);
//     res.status(500).json({ success: false, error: error.message });
//   }
// });


/**--------FETCHING CASTING DATA FROM SALESFORCE --------- */
// app.get("/api/casting/:date/:month/:year/:number", async (req, res) => {
//   try {
//     const { date, month, year, number } = req.params;
//     const castingId = `${date}/${month}/${year}/${number}`;

//     if (!castingId) {
//       return res.status(400).json({
//         success: false,
//         message: "Casting ID is required",
//       });
//     }

//     const pool = await poolPromise;

//     // 1. Get Casting details
//     const castingQuery = await pool.request()
//       .input("castingId", sql.VarChar, castingId)
//       .query(`SELECT 
//         Id,
//         Name,
//         Issued_Date_c,
//         Wax_Tree_Weight_c,
//         Required_Purity_c,
//         Gold_Tree_Weight_c,
//         Required_Pure_Metal_Casting_c,
//         Required_Alloy_for_Casting_c,
//         Issud_weight_c
//        FROM Casting_dept__c
//        WHERE Name = @castingId`);

//     if (!castingQuery.recordset || castingQuery.recordset.length === 0) {
//       return res.status(404).json({
//         success: false,
//         message: "Casting not found",
//       });
//     }

//     const casting = castingQuery.recordset[0];

//     // 2. Get Related Orders
//     const ordersQuery = await pool.request()
//       .input("castingId", sql.VarChar, casting.Id)
//       .query(`SELECT 
//         Id,
//         Order_Id_c
//        FROM Order__c  
//        WHERE Casting_c = @castingId`);

//     // 3. Get Related Inventory Items
//     const inventoryQuery = await pool.request()
//       .input("castingId", sql.VarChar, casting.Id)
//       .query(`SELECT 
//         Name,
//         Issued_Date_c,
//         Purity_c,
//         Issue_Weight_c,
//         Pure_Metal_weight_c,
//         Alloy_Weight_c,
//         Casting_c
//        FROM Issued_inventory__c 
//        WHERE Casting_c = @castingId`);

//     // 4. Prepare summary
//     const totalIssuedWeight = inventoryQuery.recordset.reduce((sum, item) => sum + (item.Issue_Weight__c || 0), 0);
//     const totalPureMetalWeight = inventoryQuery.recordset.reduce((sum, item) => sum + (item.Pure_Metal_weight__c || 0), 0);
//     const totalAlloyWeight = inventoryQuery.recordset.reduce((sum, item) => sum + (item.Alloy_Weight__c || 0), 0);

//     // 5. Prepare response
//     const response = {
//       success: true,
//       data: {
//         casting,
//         orders: ordersQuery.recordset,
//         inventoryItems: inventoryQuery.recordset,
//       },
//       summary: {
//         totalOrders: ordersQuery.recordset.length,
//         totalInventoryItems: inventoryQuery.recordset.length,
//         totalIssuedWeight,
//         totalPureMetalWeight,
//         totalAlloyWeight,
//       },
//     };

//     res.json(response);
//   } catch (error) {
//     console.error("Error fetching casting details:", error);
//     res.status(500).json({
//       success: false,
//       message: error.message || "Failed to fetch casting details",
//     });
//   }
// });

/**-----------------Get all Casting Details  ----------------- */
 // ensure you're importing mssql

// app.get("/api/casting/all/:date/:month/:year/:number",checkSalesforceConnection, async (req, res) => {
//   try {
//     const { date, month, year, number } = req.params;
//     const castingId = `${date}/${month}/${year}/${number}`;

//     if (!castingId) {
//       return res.status(400).json({
//         success: false,
//         message: "Casting ID is required"
//       });
//     }

//     const pool = req.mssql; // or use your existing pool

//     // 1. Get Casting details
//     const castingResult = await pool.request()
//       .input("castingId", sql.NVarChar, castingId)
//       .query(`
//         SELECT 
//           Id,
//           Name,
//           Issued_Date_c,
//           Issud_weight_c,
//           Weight_Received_c,
//           Received_Date_c,
//           Status_c,
//           Casting_Loss_c
//         FROM Casting_dept__c
//         WHERE Name = @castingId
//       `);

//     if (!castingResult.recordset || castingResult.recordset.length === 0) {
//       return res.status(404).json({
//         success: false,
//         message: "Casting not found"
//       });
//     }

//     const casting = castingResult.recordset[0];
//     console.log("Found casting record:", casting);

//     // 2. Get Related Orders
//     const ordersResult = await pool.request()
//       .input("castingId", sql.NVarChar, casting.Id)
//       .query(`
//         SELECT 
//           Id,
//           Order_Id_c,
//           id_c,
//           Casting_c
//         FROM Order__c 
       
//       `);

//     const orders = ordersResult.recordset;

//     // 3. Get Related Inventory Items
//     const inventoryResult = await pool.request()
//       .input("castingId", sql.NVarChar, casting.Id)
//       .query(`
//         SELECT 
//           Name,
//           Issued_Date_c,
//           Purity_c,
//           Issue_Weight_c,
//           Pure_Metal_weight_c,
//           Alloy_Weight_c,
//           Casting_c
//         FROM Issued_inventory__c 
//         WHERE Casting_c = @castingId
//       `);

//     const inventoryItems = inventoryResult.recordset;

//     // 4. Prepare response
//     const response = {
//       success: true,
//       data: {
//         casting,
//         orders,
//         inventoryItems
//       },
//       summary: {
//         totalOrders: orders.length,
//         totalInventoryItems: inventoryItems.length,
//         totalIssuedWeight: inventoryItems.reduce((sum, item) =>
//           sum + (item.Issue_Weight_c || 0), 0),
//         totalPureMetalWeight: inventoryItems.reduce((sum, item) =>
//           sum + (item.Pure_Metal_weight_c || 0), 0),
//         totalAlloyWeight: inventoryItems.reduce((sum, item) =>
//           sum + (item.Alloy_Weight_c || 0), 0)
//       }
//     };

//     res.json(response);

//   } catch (error) {
//     console.error("Error fetching casting details:", error);
//     res.status(500).json({
//       success: false,
//       message: error.message || "Failed to fetch casting details"
//     });
//   }
// });


/**----------------fetch Grinding pouch categories----------------- */
// app.get("/api/orders/:orderId/:orderNumber/categories", checkSalesforceConnection, async (req, res) => {
//   try {
//     const { orderId, orderNumber } = req.params;
//     const orderIdentifier = `${orderId}/${orderNumber}`;
//     console.log('Requested Order ID:', orderIdentifier);
// console.log("Final orderIdentifier:", orderIdentifier);
//     const pool = req.mssql;

//     // 1. Get the Order__c ID using Order_Id__c
//     const orderResult = await pool.request()
//       .input('orderIdentifier', sql.VarChar, orderIdentifier)
//       .query(`SELECT Id FROM Order__c WHERE Order_Id_c = @orderIdentifier`);

//     if (!orderResult.recordset || orderResult.recordset.length === 0) {
//       return res.status(404).json({
//         success: false,
//         message: "Order not found"
//       });
//     }

//     const orderSfId = orderResult.recordset[0].Id;

//     // 2. Get all models for this order
//     const modelsResult = await pool.request()
//       .input('orderId', sql.NVarChar, orderSfId)
//       .query(`
//         SELECT 
//           Id,
//           Name,
//           Category_c,
//           Purity_c,
//           Size_c,
//           Color_c,
//           Quantity_c,
//           Gross_Weight_c,
//           Stone_Weight_c,
//           Net_Weight_c
//         FROM Order_Models__c
//         WHERE Order_c = @orderId
//       `);

//     const models = modelsResult.recordset;

//     // 3. Group models by Category__c
//     const categorizedModels = {};
//     models.forEach(model => {
//       const category = model.Category__c || 'Uncategorized';
//       if (!categorizedModels[category]) {
//         categorizedModels[category] = [];
//       }
//       categorizedModels[category].push(model);
//     });

//     res.json({
//       success: true,
//       data: {
//         categories: categorizedModels
//       },
//       summary: {
//         totalCategories: Object.keys(categorizedModels).length,
//         totalModels: models.length
//       }
//     });

//   } catch (error) {
//     console.error("Error fetching categories:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to fetch categories",
//       error: error.message
//     });
//   }
// });

app.get("/api/orders/:orderId/:orderNumber/categories", async (req, res) => {
  try {
    const { orderId, orderNumber } = req.params;
    const orderIdentifier = `${orderId}/${orderNumber}`;
    console.log('Requested Order ID:', orderIdentifier);

    const pool = await poolPromise;

    // 1. Get Order Id from SQL
    const orderResult = await pool.request()
      .query(`SELECT Id FROM Order__c WHERE Order_Id_c = '${orderIdentifier}'`);

    if (!orderResult.recordset || orderResult.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Order not found in database"
      });
    }

    const orderSfId = orderResult.recordset[0].Id;
    console.log("✅ Got orderSfId:", orderSfId);

    // 2. Fetch categories using string interpolation
    const categoryResult = await pool.request().query(`
      SELECT DISTINCT Category_c 
      FROM Order_Models__c 
      WHERE Order_c = '${orderSfId}'
    `);

    // 3. Get all models
    const modelResult = await pool.request().query(`
      SELECT 
        Id,
        Name,
        Category_c,
        Purity_c,
        Size_c,
        Color_c,
        Quantity_c,
        Gross_Weight_c,
        Stone_Weight_c,
        Net_Weight_c
      FROM Order_Models__c
      WHERE Order_c = '${orderSfId}'
    `);

    // 4. Group by category
    const categorizedModels = {};
    modelResult.recordset.forEach(model => {
      const category = model.Category_c || 'Uncategorized';
      if (!categorizedModels[category]) {
        categorizedModels[category] = [];
      }
      categorizedModels[category].push(model);
    });

    // 5. Send response
    res.json({
      success: true,
      data: {
        categories: categorizedModels
      },
      summary: {
        totalCategories: Object.keys(categorizedModels).length,
        totalModels: modelResult.recordset.length
      }
    });

  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch categories",
      error: error.message
    });
  }
});

/**---------------- Start the Server ------------------ **/

const PORT = process.env.PORT || 4001;
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));

/**-----------------Grinding Details ----------------- */



// app.get("/api/filing",checkSalesforceConnection, async (req, res) => {
//   try {
//     console.log('Fetching filing records - API call started');
//     const pool = req.mssql;

//     const query = `
//       SELECT 
//         Name,
//         Issued_weight_c,
//         Issued_Date_c,
//         Receievd_weight_c,
//         Received_Date_c,
//         Order_Id_c,
//         Product_c,
//         Quantity_c,
//         Status_c,
//         Filing_loss_c,
//         Filing_scrap_Weight_c,
//         Filing_Dust_Weight_c
//       FROM Filing__c
//       ORDER BY Issued_Date_c DESC
//     `;

//     console.log('Executing SQL query:', query);

//     const result = await pool.request().query(query);

//     console.log('Raw SQL response:', JSON.stringify(result, null, 2));
//     console.log('Number of records found:', result.recordset?.length || 0);

//     const filingRecords = result.recordset.map(record => {
//       return {
//         Name: record.Name,
//         Issued_Weight: record.Issued_weight_c,
//         Issued_Date: record.Issued_Date_c,
//         Received_Weight: record.Receievd_weight_c,
//         Received_Date: record.Received_Date_c,
//         OrderId: record.Order_Id_c,
//         product: record.Product_c,
//         quantity: record.Quantity_c,
//         Status: record.Status_c,
//         Filing_Loss: record.Filing_loss_c,
//         Filing_Scrap_Weight: record.Filing_scrap_Weight_c,
//         Filing_Dust_Weight: record.Filing_Dust_Weight_c
//       };
//     });

//     console.log('Formatted filing recordsets:', JSON.stringify(filingRecords, null, 2));

//     const response = {
//       success: true,
//       data: filingRecords
//     };

//     console.log('Sending response to client:', JSON.stringify(response, null, 2));
//     res.json(response);

//   } catch (error) {
//     console.error("Error in /api/filing endpoint:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to fetch filing records from SQL Server",
//       error: error.message
//     });
//   }
// });


/**--------------------Grinding Details ----------------- */
// app.get("/api/filing/:prefix/:date/:month/:year/:number/:numb",checkSalesforceConnection, async (req, res) => {
//   try {
    
//    const pool = req.mssql;
//     const { prefix, date, month, year, number, numb } = req.params;
//     const filingId = `${prefix}/${date}/${month}/${year}/${number}/${numb}`;
    
//     console.log('Requested Filing ID:', filingId);

//     // Query for filing details
//     const filingQuery = await pool.request().query(
//       `SELECT 
//         Id,
//         Name,
//         Issued_Date_c,
//         Issued_weight_c,
//         Receievd_weight_c,
//         Received_Date_c,
//         Status_c,
//         Filing_loss_c
//        FROM Filing__c
//        WHERE Name = '${filingId}'`
//     );

//     console.log('Query result:', JSON.stringify(filingQuery, null, 2));

//     if (!filingQuery.records || filingQuery.recordset.length === 0) {
//       console.log('No records found for filing ID:', filingId);
//       return res.status(404).json({
//         success: false,
//         message: "Filing record not found"
//       });
//     }

//     const filing = filingQuery.recordset[0];
//     console.log('Found filing record:', filing);

//     // Get Related Pouches
//     const pouchesQuery = await pool.request().query(
//       `SELECT 
//         Id,
//         Name,
//         Order_Id_c,
//         Filing_c,
//         Issued_Pouch_weight_c
//        FROM Pouch__c 
//        WHERE Filing_c = '${filing.Id}'`
//     );

//     console.log('Found pouches:', pouchesQuery.recordset);

//     const response = {
//       success: true,
//       data: {
//         filing: filingQuery.records[0],
//         pouches: pouchesQuery.records || []
//       }
//     };

//     console.log('Sending response:', JSON.stringify(response, null, 2));
//     res.json(response);

//   } catch (error) {
//     console.error("Error fetching filing details:", error);
//     console.error("Full error details:", JSON.stringify(error, null, 2));
//     res.status(500).json({
//       success: false,
//       message: error.message || "Failed to fetch filing details"
//     });
//   }
// });





/***-------------Completed Grinding Details ----------------- */
// app.get("/api/filing-details/:prefix/:date/:month/:year/:number/:numb", async (req, res) => {
//   try {

//     const pool = req.mssql;
//     const { prefix, date, month, year, number,numb } = req.params;
//     const filingId = `${prefix}/${date}/${month}/${year}/${number}/${numb}`;
//         console.log('Requested Filing ID:', filingId);

//     // 1. Get Grinding details
//     const filingQuery = await pool.request().query(
//       `SELECT 
//         Id,
//         Name,
//         Issued_Date_c,
//         Issued_weight_c,
//         Receievd_weight_c,
//         Received_Date_c,
//         Status_c,
//         Filing_loss_c
//        FROM Filing__c
//        WHERE Name = '${filingId}'`
//     );

//     if (!filingQuery.records || filingQuery.recordset.length === 0) {
//       return res.status(404).json({
//         success: false,
//         message:   "Filing record not found"
//       });
//     }

//     const filing = filingQuery.recordset[0];
//       console.log('Found filing record:', filing);

//     // 2. Get Pouches for this grinding
//     const pouchesQuery = await pool.request().query(
//       `SELECT 
//         Id,
//         Name,
//         Order_Id_c,
//         Issued_Pouch_weight_c
//        FROM Pouch__c 
//        WHERE Filing_c = '${filing.Id}'`
//     );

//     console.log('Found pouches:', pouchesQuery.recordset);

//     // 3. Get Orders for these pouches
//     const orderIds = pouchesQuery.recordset.map(pouch => `'${pouch.Order_Id__c}'`).join(',');
//     let orders = [];
//     let models = [];


//     if (orderIds.length > 0) {
//       const ordersQuery = await pool.request().query(
//         `SELECT 
//           Id,
//           Name,
//           Order_Id_c,
//           Party_Name_c,
//           Delivery_Date_c,
//           Status_c
//          FROM Order_c 
//          WHERE Order_Id_c IN (${orderIds})`
//       );
      
//       orders = ordersQuery.recordset;
//       console.log('Found orders:', orders);

//       // 4. Get Models for these orders
//       const orderIdsForModels = orders.map(order => `'${order.Id}'`).join(',');
//       if (orderIdsForModels.length > 0) {
//         const modelsQuery = await  pool.request().query(
//           `SELECT 
//             Id,     
//             Name,
//             Order_c,
//             Category_c,
//             Purity_c,
//             Size_c,
//             Color_c,
//             Quantity_c,
//             Gross_Weight_c,
//             Stone_Weight_c,
//             Net_Weight_c
//            FROM Order_Models__c 
//            WHERE Order_c IN (${orderIdsForModels})`
//         );
        
//         models = modelsQuery.recordset;
//         console.log('Found models:', models);
//       }
//     }

//    // 5. Organize the data hierarchically
// // Then in the response construction
// const response = {
//   success: true,
//   data: {
//     filing: filing,
//     pouches: pouchesQuery.recordset.map(pouch => {
//       const relatedOrder = orders.find(order => order.Order_Id__c === pouch.Order_Id__c);
      
//       // Now models will have Order__c field to match with
//       const pouchModels = relatedOrder ? models.filter(model => 
//         model.Order__c === relatedOrder.Id
//       ) : [];

//       return {
//         ...pouch,
//         order: relatedOrder || null,
//         models: pouchModels
//       };
//     })
//   },
//   summary: {
//     totalPouches: pouchesQuery.recordset.length,
//     totalOrders: orders.length,
//     totalModels: models.length,
//     totalPouchWeight: pouchesQuery.recordset.reduce((sum, pouch) => 
//       sum + (pouch.Issued_Pouch_weight__c || 0), 0),
//     issuedWeight: filing.Issued_weight__c,
//     receivedWeight: filing.Receievd_weight__c,
//     filingLoss: filing.Filing_loss__c
//   }
// };

// // Add debug logging
// console.log('Orders mapping:', orders.map(o => ({ id: o.Id, orderId: o.Order_Id__c })));
// console.log('Models mapping:', models.map(m => ({ id: m.Id, orderId: m.Order__c })))
 
//     console.log('Sending response:', JSON.stringify(response, null, 2));
//     res.json(response);

//   } catch (error) {
//     console.error("Error fetching filing details:", error);
//     console.error("Fulal error details:", JSON.stringify(error, null, 2));
//     res.status(500).json({
//       success: false,
//       message: error.message || "Failed to fetch filing details"
//     });
//   }
// });

/***-------------Grinding Details ----------------- */
/***-------------Fetch pouch details  from filing----------------- */
// app.get("/api/filing/:prefix/:date/:month/:year/:number/:subnumber/pouches", checkSalesforceConnection, async (req, res) => {
//   try {
//     const { prefix, date, month, year, number,subnumber } = req.params;
//     const filingId = `${prefix}/${date}/${month}/${year}/${number}/${subnumber}`;
     
//     const pool = req.mssql;
     
//     console.log('[Get Pouches] Fetching pouches for filing:', filingId);
     
//     // First get the Filing record
//     const filingQuery = await pool.request.query(
//       `SELECT Id FROM Filing__c WHERE Name = '${filingId}'`
//     );

//     if (!filingQuery.records || filingQuery.recordset.length === 0) {
//       console.log('[Get Pouches] Filing not found:', filingId);
//       return res.status(404).json({
//         success: false,
//         message: "Filing record not found"
//       });
//     }

//     // Get pouches with their IDs and issued weights
//     const pouchesQuery = await pool.request.query.query(
//       `SELECT 
//         Id, 
//         Name, 
//         	Received_Pouch_weight__c,
//           Product__c,
//           Quantity__c,
//           Order_Id__c
//        FROM Pouch__c 
//        WHERE Filing__c = '${filingQuery.recordset[0].Id}'`
//     );

//     console.log('[Get Pouches] Found pouches:', pouchesQuery.recordset);

//     res.json({
//       success: true,
//       data: {
//         pouches: pouchesQuery.recordset
//       }
//     });

//   } catch (error) {
//     console.error("[Get Pouches] Error:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to fetch pouches"
//     });
//   }
// });





// app.get("/api/grinding", checkSalesforceConnection, async(req, res) => {

//   const pool = req.mssql;
//   try {
//     const grindingQuery = await pool.request().query(
//       `SELECT Id, Name, Issued_Date_c, Issued_Weight_c,Received_Date_c,Received_Weight_c,Status_c,Grinding_loss_c,Product_c,Quantity_c,Order_Id_c,Grinding_Scrap_Weight_C,Grinding_Dust_Weight_c FROM Grinding__c
//        ORDER BY Issued_Date_c DESC`
//     );

//     res.json({
//       success: true,
//       data: grindingQuery.recordset
//     });
//   } catch (error) {
//     console.error("Error fetching grinding records:", error); 
//     res.status(500).json({
//       success: false,
//       message: error.message || "Failed to fetch grinding records"
//     });
//   }
// });

// app.get("/api/grinding/:prefix/:date/:month/:year/:number/:subnumber",checkSalesforceConnection, async (req, res) => {
//   try {
//     const pool = req.mssql;
//     const { prefix, date, month, year, number,subnumber } = req.params;
//     const grindingId = `${prefix}/${date}/${month}/${year}/${number}/${subnumber}`;
    
//     console.log('Requested Grinding ID:', grindingId);

//     // Query for grinding details
//     const grindingQuery = await pool.request().query(
//       `SELECT 
//         Id,
//         Name,
//         Issued_Date_c,
//         Issued_Weight_c,
//         Received_Weight_c,
//         Received_Date_c,
//         Product_c,
//         Quantity_c,
//       	Order_Id_c,
//         status_c,
//         Grinding_loss_c
//        FROM Grinding__c
//        WHERE Name = '${grindingId}'`
//     );

//     if (!grindingQuery.records || grindingQuery.recordset.length === 0) {
//       return res.status(404).json({
//         success: false,
//         message: "Grinding record not found"
//       });
//     }

//     const grinding = grindingQuery.records[0];

//     // Get Related Pouches
//     const pouchesQuery = await pool.request().query(
//       `SELECT 
//         Id,
//         Name,
//         Order_Id_c,
//         Grinding_c,
//         Isssued_Weight_Grinding_c,
//         Product_c,
//         Quantity_c
//        FROM Pouch__c 
//        WHERE Grinding_c = '${grinding.Id}'`
//     );

//     const response = {
//       success: true,
//       data: {
//         grinding: grindingQuery.records[0],
//         pouches: pouchesQuery.records || []
//       }
//     };

//     res.json(response);

//   } catch (error) {
//     console.error("Error fetching grinding details:", error);
//     console.error("Full error details:", JSON.stringify(error, null, 2));
//     res.status(500).json({
//       success: false,
//       message: error.message || "Failed to fetch grinding details"
//     });
//   }
// });

/**-----------------Get all Grinding Details ----------------- */
// app.get("/api/grinding-details/:prefix/:date/:month/:year/:number",checkSalesforceConnection, async (req, res) => {
//   try {

//      const pool = req.mssql;
//     const { prefix, date, month, year, number } = req.params;
//     const grindingId = `${prefix}/${date}/${month}/${year}/${number}`;

//     // 1. Get Grinding details
//     const grindingQuery = await pool.request().query(
//       `SELECT 
//         Id,
//         Name,
//         Issued_Date_c,
//         Issued_Weight_c,
//         Received_Weight_c,
//         Received_Date_c,
//         Status_c,
//         Grinding_loss_c
//        FROM Grinding__c
//        WHERE Name = '${grindingId}'`
//     );

//     if (!grindingQuery.records || grindingQuery.recordset.length === 0) {
//       return res.status(404).json({
//         success: false,
//         message: "Grinding record not found"
//       });
//     }

//     const grinding = grindingQuery.recordset[0];

//     // 2. Get Pouches for this grinding
//     const pouchesQuery = await pool.request().query(
//       `SELECT 
//         Id,
//         Name,
//         Order_Id_c,
//         Isssued_Weight_Grinding_c
//        FROM Pouch__c 
//        WHERE Grinding_c = '${grinding.Id}'`
//     );

//     // 3. Get Orders for these pouches
//     const orderIds = pouchesQuery.recordset.map(pouch => `'${pouch.Order_Id__c}'`).join(',');
//     let orders = [];
//     let models = [];

//     if (orderIds.length > 0) {
//       const ordersQuery = await pool.request().query(
//         `SELECT 
//           Id,
//           Name,
//           Order_Id_c,
//           Party_Name_c,
//           Delivery_Date_c,
//           Status_c
//          FROM Order__c 
//          WHERE Order_Id__c IN (${orderIds})`
//       );
      
//       orders = ordersQuery.recordset;

//       // 4. Get Models for these orders
//       const orderIdsForModels = orders.map(order => `'${order.Id}'`).join(',');
//       if (orderIdsForModels.length > 0) {
//         const modelsQuery = await pool.request().query(
//           `SELECT 
//             Id,     
//             Name,
//             Order_c,
//             Category_c,
//             Purity_c,
//             Size_c,
//             Color_c,
//             Quantity_c,
//             Gross_Weight_c,
//             Stone_Weight_c,
//             Net_Weight_c
//            FROM Order_Models__c 
//            WHERE Order_c IN (${orderIdsForModels})`
//         );
        
//         models = modelsQuery.records;
//       }
//     }

//     const response = {
//       success: true,
//       data: {
//         grinding: grinding,
//         pouches: pouchesQuery.recordset.map(pouch => {
//           const relatedOrder = orders.find(order => order.Order_Id__c === pouch.Order_Id__c);
//           const pouchModels = relatedOrder ? models.filter(model => 
//             model.Order__c === relatedOrder.Id
//           ) : [];

//           return {
//             ...pouch,
//             order: relatedOrder || null,
//             models: pouchModels
//           };
//         })
//       },
//       summary: {
//         totalPouches: pouchesQuery.recordset.length,
//         totalOrders: orders.length,
//         totalModels: models.length,
//         totalPouchWeight: pouchesQuery.records.reduce((sum, pouch) => 
//           sum + (pouch.Isssued_Weight_Grinding__c || 0), 0),
//         issuedWeight: grinding.Issued_Weight__c,
//         receivedWeight: grinding.Received_Weight__c,
//         grindingLoss: grinding.Grinding_loss__c
//       }
//     };

//     res.json(response);

//   } catch (error) {
//     console.error("Error fetching grinding details:", error);
//     console.error("Full error details:", JSON.stringify(error, null, 2));
//     res.status(500).json({
//       success: false,
//       message: error.message || "Failed to fetch grinding details"
//     });
//   }
// });



/**----------------- Update Inventory Weights for Casting ----------------- **/
app.put("/api/update-inventoryweights",checkSalesforceConnection, async (req, res) => {
  try {
    const pool = req.mssql;
    const { issuedItems } = req.body;

    console.log('Received inventory weight update request:', { issuedItems });

    if (!issuedItems || !Array.isArray(issuedItems) || issuedItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Valid issuedItems array is required"
      });
    }

    const updateResults = [];

    for (const item of issuedItems) {
      console.log('Processing item:', item);

      const result = await pool.request()
        .input('itemName', item.itemName)
        .input('purity', item.purity)
        .query(`
          SELECT Id, Available_weight_c 
          FROM Inventory_ledger__c 
          WHERE Item_Name_c = @itemName AND Purity_c = @purity
        `);

      const existing = result.recordset[0];

      if (!existing) {
        throw new Error(`Inventory item not found: ${item.itemName} (${item.purity})`);
      }

      const currentWeight = parseFloat(existing.Available_weight_c || 0);
      const deductWeight = parseFloat(item.issueWeight);
      const newWeight = currentWeight - deductWeight;

      if (newWeight < 0) {
        throw new Error(`Insufficient inventory for ${item.itemName} (${item.purity}). Available: ${currentWeight}, Required: ${deductWeight}`);
      }

      await pool.request()
        .input('id', existing.Id)
        .input('newWeight', newWeight)
        .input('lastUpdated', new Date())
        .query(`
          UPDATE Inventory_ledger__c
          SET Available_weight_c = @newWeight,
              Last_Updated_c = @lastUpdated
          WHERE Id = @id
        `);

      updateResults.push({
        itemName: item.itemName,
        purity: item.purity,
        previousWeight: currentWeight,
        deductedWeight: deductWeight,
        newWeight,
        success: true
      });
    }

    res.status(200).json({
      success: true,
      message: "Inventory weights updated successfully",
      data: updateResults
    });

  } catch (error) {
    console.error("Error updating inventory weights:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to update inventory weights"
    });
  }
});


/**-----------------Setting Details ----------------- */
// app.get("/api/setting/:prefix/:date/:month/:year/:number/:subnumber", async (req, res) => {
//   try {
//    const pool = req.mssql;

//     const { prefix, date, month, year, number, subnumber } = req.params;
//     const settingId = `${prefix}/${date}/${month}/${year}/${number}/${subnumber}`;
    
//     console.log('Requested Setting ID:', settingId);

//     // Query for setting details
//     const settingQuery = await pool.request().query(
//       `SELECT 
//         Id,
//         Name,
//         Issued_Date__c,
//         Issued_Weight__c,
//         Returned_weight__c,
//         Received_Date__c,
//         Status__c,
//         Setting_l__c
//        FROM Setting__c
//        WHERE Name = '${settingId}'`
//     );

//     if (!settingQuery.records || settingQuery.records.length === 0) {
//       return res.status(404).json({
//         success: false,
//         message: "Setting record not found"
//       });
//     }

//     const setting = settingQuery.records[0];

//     // Get Related Pouches
//     const pouchesQuery = await pool.request().query(
//       `SELECT 
//         Id,
//         Name,
//         Order_Id_c,
//         Setting_c,
//         Issued_weight_setting_c
//        FROM Pouch__c 
//        WHERE Setting_c = '${setting.Id}'`
//     );

//     const response = {
//       success: true,
//       data: {
//         setting: settingQuery.records[0],
//         pouches: pouchesQuery.records || []
//       }
//     };

//     res.json(response);

//   } catch (error) {
//     console.error("Error fetching setting details:", error);
//     console.error("Full error details:", JSON.stringify(error, null, 2));
//     res.status(500).json({
//       success: false,
//       message: error.message || "Failed to fetch setting details"
//     });
//   }
// });

/**-----------------Get all Setting Details ----------------- */
// app.get("/api/setting-details/:prefix/:date/:month/:year/:number/:subm",checkSalesforceConnection, async (req, res) => {
//   try {
//     const pool = req.mssql;
//     const { prefix, date, month, year, number } = req.params;
//     const settingId = `${prefix}/${date}/${month}/${year}/${number}`;

//     // 1. Get Setting details
//     const settingQuery = await pool.request().query(
//       `SELECT 
//         Id,
//         Name,
//         Issued_Date_c,
//         Issued_Weight_c,
//         Returned_weight_c,
//         Received_Date_c,
//         Status_c,
//         Setting_l_c
//        FROM Setting__c
//        WHERE Name = '${settingId}'`
//     );

//     if (!settingQuery.records || settingQuery.records.length === 0) {
//       return res.status(404).json({
//         success: false,
//         message: "Setting record not found"
//       });
//     }

//     const setting = settingQuery.records[0];

//     // 2. Get Pouches for this setting
//     const pouchesQuery = await pool.request().query(
//       `SELECT 
//         Id,
//         Name,
//         Order_Id_c,
//         Issued_weight_setting_c
//        FROM Pouch__c 
//        WHERE Setting_c = '${setting.Id}'`
//     );

//     // 3. Get Orders for these pouches
//     const orderIds = pouchesQuery.records.map(pouch => `'${pouch.Order_Id__c}'`).join(',');
//     let orders = [];
//     let models = [];

//     if (orderIds.length > 0) {
//       const ordersQuery = await pool.request().query(
//         `SELECT 
//           Id,
//           Name,
//           Order_Id_c,
//           Party_Name_c,
//           Delivery_Date_c,
//           Status_c
//          FROM Order__c 
//          WHERE Order_Id_c IN (${orderIds})`
//       );
      
//       orders = ordersQuery.recordset;

//       // 4. Get Models for these orders
//       const orderIdsForModels = orders.map(order => `'${order.Id}'`).join(',');
//       if (orderIdsForModels.length > 0) {
//         const modelsQuery = await conn.query(
//           `SELECT 
//             Id,     
//             Name,
//             Order_c,
//             Category_c,
//             Purity_c,
//             Size_c,
//             Color_c,
//             Quantity_c,
//             Gross_Weight_c,
//             Stone_Weight_c,
//             Net_Weight_c
//            FROM Order_Models__c 
//            WHERE Order_c IN (${orderIdsForModels})`
//         );
        
//         models = modelsQuery.records;
//       }
//     }

//     const response = {
//       success: true,
//       data: {
//         setting: setting,
//         pouches: pouchesQuery.recordset.map(pouch => {
//           const relatedOrder = orders.find(order => order.Order_Id__c === pouch.Order_Id__c);
//           const pouchModels = relatedOrder ? models.filter(model => 
//             model.Order__c === relatedOrder.Id
//           ) : [];

//           return {
//             ...pouch,
//             order: relatedOrder || null,
//             models: pouchModels
//           };
//         })
//       },
//       summary: {
//         totalPouches: pouchesQuery.recordset.length,
//         totalOrders: orders.length,
//         totalModels: models.length,
//         totalPouchWeight: pouchesQuery.recordset.reduce((sum, pouch) => 
//               sum + (pouch.Issued_weight_setting__c || 0), 0),
//         issuedWeight: setting.Issued_Weight__c,
//         receivedWeight: setting.Returned_weight__c,
//         settingLoss: setting.Setting_l__c
//       }
//     };

//     res.json(response);

//   } catch (error) {
//     console.error("Error fetching setting details:", error);
//     console.error("Full error details:", JSON.stringify(error, null, 2));
//     res.status(500).json({
//       success: false,
//       message: error.message || "Failed to fetch setting details"
//     });
//   }
// });

/**-----------------Update Setting Received Weight ----------------- */
// app.post("/api/setting/update/:prefix/:date/:month/:year/:number/:subnumber", async (req, res) => {
//   try {
//     const { prefix, date, month, year, number, subnumber } = req.params;
//     const { receivedDate, receivedWeight, settingLoss, scrapReceivedWeight, dustReceivedWeight, totalStoneWeight, ornamentWeight, pouches } = req.body;
//     const settingNumber = `${prefix}/${date}/${month}/${year}/${number}/${subnumber}`;

//     console.log('[Setting Update] Received data:', { 
//       settingNumber, 
//       receivedDate, 
//       receivedWeight, 
//       settingLoss,
//       scrapReceivedWeight,
//       dustReceivedWeight,
//       ornamentWeight,
//       pouches 
//     });

//     // First get the Setting record
//     const settingQuery = await conn.query(
//       `SELECT Id, Name FROM Setting__c WHERE Name = '${settingNumber}'`
//     );

//     if (!settingQuery.records || settingQuery.records.length === 0) {
//       return res.status(404).json({
//         success: false,
//         message: "Setting record not found"
//       });
//     }

//     const setting = settingQuery.records[0];

//     // Update the setting record
//     const updateData = {
//       Id: setting.Id,
//       Received_Date__c: receivedDate,
//       Returned_weight__c: receivedWeight,
//       Setting_l__c: settingLoss,
//       Stone_Weight__c: totalStoneWeight,
//       Setting_Scrap_Weight__c: scrapReceivedWeight,
//       Setting_Dust_Weight__c: dustReceivedWeight,
//       Setting_Ornament_Weight__c: ornamentWeight,
//       Status__c: 'Finished'
//     };

//     const updateResult = await conn.sobject('Setting__c').update(updateData);

//     if (!updateResult.success) {
//       throw new Error('Failed to update setting record');
//     }

//     // Update pouches if provided
//     if (pouches && pouches.length > 0) {
//       for (const pouch of pouches) {
//         try {
//           const pouchUpdateResult = await conn.sobject('Pouch__c').update({
//             Id: pouch.pouchId,
//             Received_Weight_Setting__c: pouch.receivedWeight,
//             Stone_Weight_Setting__c: pouch.stoneWeight,
//             	Setting_loss__c: pouch.settingLoss
//           });

//           console.log(`[Setting Update] Pouch update result for ${pouch.pouchId}:`, pouchUpdateResult);
//         } catch (pouchError) {
//           console.error(`[Setting Update] Failed to update pouch ${pouch.pouchId}:`, pouchError);
//           throw pouchError;
//         }
//       }
//     }

//     // Check if scrap inventory exists for this purity
//     const scrapInventoryQuery = await conn.query(
//       `SELECT Id, Available_weight__c FROM Inventory_ledger__c 
//        WHERE Item_Name__c = 'Scrap' 
//        AND Purity__c = '91.7%'`
//     );

//     if (scrapReceivedWeight > 0) {
//       if (scrapInventoryQuery.records.length > 0) {
//         // Update existing scrap inventory
//         const currentWeight = scrapInventoryQuery.records[0].Available_weight__c || 0;
//         const scrapUpdateResult = await conn.sobject('Inventory_ledger__c').update({
//           Id: scrapInventoryQuery.records[0].Id,
//           Available_weight__c: currentWeight + scrapReceivedWeight,
//           Last_Updated__c: receivedDate
//         });

//         if (!scrapUpdateResult.success) {
//           throw new Error('Failed to update scrap inventory');
//         }
//       } else {
//         // Create new scrap inventory
//         const scrapCreateResult = await conn.sobject('Inventory_ledger__c').create({
//           Name: 'Scrap',
//           Item_Name__c: 'Scrap',
//           Purity__c: setting.Purity__c,
//           Available_weight__c: scrapReceivedWeight,
//           Unit_of_Measure__c: 'Grams',
//           Last_Updated__c: receivedDate
//         });

//         if (!scrapCreateResult.success) {
//           throw new Error('Failed to create scrap inventory');
//         }
//       }
//     }

//     // Check if dust inventory exists
//     const dustInventoryQuery = await conn.query(
//       `SELECT Id, Available_weight__c FROM Inventory_ledger__c 
//        WHERE Item_Name__c = 'Dust' 
//        AND Purity__c = '91.7%'`
//     );

//     if (dustReceivedWeight > 0) {
//       if (dustInventoryQuery.records.length > 0) {
//         // Update existing dust inventory
//         const currentWeight = dustInventoryQuery.records[0].Available_weight__c || 0;
//         const dustUpdateResult = await conn.sobject('Inventory_ledger__c').update({
//           Id: dustInventoryQuery.records[0].Id,
//           Available_weight__c: currentWeight + dustReceivedWeight,
//           Last_Updated__c: receivedDate
//         });

//         if (!dustUpdateResult.success) {
//           throw new Error('Failed to update dust inventory');
//         }
//       } else {
//         // Create new dust inventory
//         const dustCreateResult = await conn.sobject('Inventory_ledger__c').create({
//           Name: 'Dust',
//           Item_Name__c: 'Dust',
//           Purity__c: setting.Purity__c,
//           Available_weight__c: dustReceivedWeight,
//           Unit_of_Measure__c: 'Grams',
//           Last_Updated__c: receivedDate
//         });

//         if (!dustCreateResult.success) {
//           throw new Error('Failed to create dust inventory');
//         }
//       }
//     }

//     res.json({
//       success: true,
//       message: "Setting record updated successfully",
//       data: {
//         settingNumber,
//         receivedDate,
//         receivedWeight,
//         settingLoss,
//         scrapReceivedWeight,
//         dustReceivedWeight,
//         ornamentWeight,
//         status: 'Finished'
//       }
//     });

//   } catch (error) {
//     console.error("[Setting Update] Error:", error);
//     console.error("[Setting Update] Full error details:", JSON.stringify(error, null, 2));
//     res.status(500).json({
//       success: false,
//       message: error.message || "Failed to update setting record"
//     });
//   }
// });

/***-------------Fetch pouch details from grinding----------------- */
// app.get("/api/grinding/:prefix/:date/:month/:year/:number/:subnumber/pouches",checkSalesforceConnection, async (req, res) => {
//   try {
// const pool = req.mssql;

//     const { prefix, date, month, year, number, subnumber } = req.params;
//     const grindingId = `${prefix}/${date}/${month}/${year}/${number}/${subnumber}`;
    
//     console.log('[Get Pouches] Fetching pouches for grinding:', grindingId);

//     // First get the Grinding record
//     const grindingQuery = await pool.request().query(
//       `SELECT Id FROM Grinding__c WHERE Name = '${grindingId}'`
//     );

//     if (!grindingQuery.records || grindingQuery.recordset.length === 0) {
//       console.log('[Get Pouches] Grinding not found:', grindingId);
//       return res.status(404).json({
//         success: false,
//         message: "Grinding record not found"
//       });
//     }

//     // Get pouches with their IDs and issued weights
//     const pouchesQuery = await pool.request().query(
//       `SELECT 
//         Id, 
//         Name,
//         Isssued_Weight_Grinding_c,
//         Received_Weight_Grinding_c,
//         Product_c,
//         Quantity_c,
//         Order_Id_c
//        FROM Pouch__c 
//        WHERE Grinding_c = '${grindingQuery.records[0].Id}'`
//     );

//     console.log('[Get Pouches] Found pouches:', pouchesQuery.recordset);

//     res.json({
//       success: true,
//       data: {
//         pouches: pouchesQuery.recordset
//       }
//     });

//   } catch (error) {
//     console.error("[Get Pouches] Error:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to fetch pouches"
//     });
//   }
// });



/**----------------- Get All Settings ----------------- */
// app.get("/api/setting",checkSalesforceConnection, async (req, res) => {
//   try {

//     const pool = req.mssql;
//     console.log('[Get Settings] Fetching all setting records');

//     const settingQuery = await pool.request().query(
//       `SELECT 
//         Id,
//         Name,
//         Issued_Date_c,
//         Issued_Weight_c,
//         Returned_weight_c,
//         Received_Date_c,
//         status_c,
//         Product_c,
//         Quantity_c,
//         Order_Id_c,
//         Stone_Weight_c,
//         Setting_l_c,
//         CreatedDate,Setting_Scrap_Weight_c,Setting_Dust_Weight_c
//        FROM Setting__c
//        ORDER BY CreatedDate DESC`
//     );

//     console.log('[Get Settings] Found settings:', settingQuery.recordset.length);

//     res.json({
//       success: true,
//       data: settingQuery.recordset
//     });

//   } catch (error) {
//     console.error("[Get Settings] Error:", error);
//     console.error("[Get Settings] Full error details:", JSON.stringify(error, null, 2));
//     res.status(500).json({
//       success: false,
//       message: error.message || "Failed to fetch setting records"
//     });
//   }
// });

// app.get("/api/setting/:prefix/:date/:month/:year/:number/:subnumber/pouches",checkSalesforceConnection, async (req, res) => {
//   try {
//     const pool = req.mssql;
//     const { prefix, date, month, year, number,subnumber } = req.params;
//     const settingId = `${prefix}/${date}/${month}/${year}/${number}/${subnumber}`;
    
//     console.log('[Get Pouches] Fetching pouches for setting:', settingId);

//     // First get the Setting record
//     const settingQuery = await pool.request().query(
//       `SELECT Id FROM Setting__c WHERE Name = '${settingId}'`
//     );

//     if (!settingQuery.recordset || settingQuery.recordset.length === 0) {
//       console.log('[Get Pouches] Setting not found:', settingId);
//       return res.status(404).json({
//         success: false,
//         message: "Setting record not found"
//       });
//     }

//     // Get pouches with their IDs and issued weights
//     const pouchesQuery = await pool.request().query(
//       `SELECT 
//         Id, 
//         Name,
//         Issued_weight_setting_c,
//         Received_Weight_Setting_c,
//         Product_c,
//         Quantity_c,
//         Order_Id_c
//        FROM Pouch__c 
//        WHERE Setting_c = '${settingQuery.records[0].Id}'`
//     );

//     console.log('[Get Pouches] Found pouches:', pouchesQuery.recordset);

//     res.json({
//       success: true,
//       data: {
//         pouches: pouchesQuery.recordset
//       }
//     });

//   } catch (error) {
//     console.error("[Get Pouches] Error:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to fetch pouches"
//     });
//   }
// });


/**----------------- Get All Polishing Records ----------------- */
// app.get("/api/polishing",checkSalesforceConnection, async (req, res) => {
//   try {

//      const pool = req.mssql;
//     console.log('[Get Polishing] Fetching all polishing records');

//     const polishingQuery = await pool.request().query(
//       `SELECT 
//         Id,
//         Name,
//         Issued_Date_c,
//         Issued_Weight_c,
//         Received_Weight_c,
//         Received_Date_c,
//         Quantity_c,
//         Order_Id_c,
//         Product_c,
//         status_c,
//         Polishing_loss_c,
//         CreatedDate,Polishing_Scrap_Weight_c,Polishing_Dust_Weight_c
//        FROM Polishing__c
//        ORDER BY CreatedDate DESC`
//     );

//     console.log('[Get Polishing] Found polishing records:', polishingQuery.recordset.length);

//     res.json({
//       success: true,
//       data: polishingQuery.recordset
//     });

//   } catch (error) {
//     console.error("[Get Polishing] Error:", error);
//     console.error("[Get Polishing] Full error details:", JSON.stringify(error, null, 2));
//     res.status(500).json({
//       success: false,
//       message: error.message || "Failed to fetch polishing records"
//     });
//   }
// });




/**----------------- Get Pouches for Polishing ----------------- */
// app.get("/api/polishing/:prefix/:date/:month/:year/:number/:subnumber/pouches",checkMssqlConnection, async (req, res) => {  
//   try {
//     const { prefix, date, month, year, number, subnumber } = req.params;
//     const polishingId = `${prefix}/${date}/${month}/${year}/${number}/${subnumber}`;
//     const pool = req.mssql;

//     console.log('[Get Pouches] Fetching pouches for polishing:', polishingId);

//     // First get the Polishing record with all details
//     const polishingQuery = await pool.request().query(
//       `SELECT 
//         Id,
//         Name,
//         Issued_Date_c,
//         Issued_Weight_c,
//         Received_Weight_c,
//         Received_Date_c,
//         Status_c,
//         Polishing_loss_c
//        FROM Polishing__c 
//        WHERE Name = '${polishingId}'`
//     );

//     if (!polishingQuery.recordset || polishingQuery.recordset.length === 0) {
//       console.log('[Get Pouches] Polishing not found:', polishingId);
//       return res.status(404).json({
//         success: false,
//         message: "Polishing record not found"
//       });
//     }

//     // Get pouches with their IDs and issued weights
//     const pouchesQuery = await pool.request().query(
//       `SELECT 
//         Id, 
//         Name,
//         Order_Id_c,
//         Issued_Weight_Polishing_c,
//         Received_Weight_Polishing_c,
//         Polishing_Loss_c
//        FROM Pouch__c 
//        WHERE Polishing__c = '${polishingQuery.recordset[0].Id}'`
//     );

//     console.log('[Get Pouches] Found pouches:', pouchesQuery.recordset);

//     res.json({
//       success: true,
//       data: {
//         polishing: polishingQuery.recordset[0],
//         pouches: pouchesQuery.recordset
//       }
//     });

//   } catch (error) {
//     console.error("[Get Pouches] Error:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to fetch pouches"
//     });
//   }
// });

/**-----------------Update Polishing Received Weight ----------------- */
// app.post("/api/polishing/update/:prefix/:date/:month/:year/:number/:subnumber", async (req, res) => {
//   try {
//     const { prefix, date, month, year, number,subnumber } = req.params;
//     const { receivedDate, receivedWeight, polishingLoss, scrapReceivedWeight, dustReceivedWeight, ornamentWeight, pouches } = req.body;
//     const polishingNumber = `${prefix}/${date}/${month}/${year}/${number}/${subnumber}`;

//     console.log('[Polishing Update] Received data:', { 
//       polishingNumber, 
//       receivedDate, 
//       receivedWeight, 
//       polishingLoss, 
//       pouches 
//     });

//     // First get the Polishing record
//     const polishingQuery = await conn.query(
//       `SELECT Id, Name FROM Polishing__c WHERE Name = '${polishingNumber}'`
//     );

//     if (!polishingQuery.records || polishingQuery.records.length === 0) {
//       return res.status(404).json({
//         success: false,
//         message: "Polishing record not found"
//       });
//     }

//     const polishing = polishingQuery.records[0];

//     // Update the polishing record
//     const updateData = {
//       Id: polishing.Id,
//       Received_Date__c: receivedDate,
//       Received_Weight__c: receivedWeight,
//       Polishing_loss__c: polishingLoss,
//       Polishing_Scrap_Weight__c: scrapReceivedWeight,
//       Polishing_Dust_Weight__c: dustReceivedWeight,
//       Polishing_Ornament_Weight__c: ornamentWeight,
//       Status__c: 'Finished'
//     };

//     const updateResult = await conn.sobject('Polishing__c').update(updateData);

//     if (!updateResult.success) {
//       throw new Error('Failed to update polishing record');
//     }

//     // Update pouches if provided
//     if (pouches && pouches.length > 0) {
//       for (const pouch of pouches) {
//         try {
//           const pouchUpdateResult = await conn.sobject('Pouch__c').update({
//             Id: pouch.pouchId,
//             Received_Weight_Polishing__c: pouch.receivedWeight,
//             Polishing_Loss__c: polishingLoss
//           });

//           console.log(`[Polishing Update] Pouch update result for ${pouch.pouchId}:`, pouchUpdateResult);
//         } catch (pouchError) {
//           console.error(`[Polishing Update] Failed to update pouch ${pouch.pouchId}:`, pouchError);
//           throw pouchError;
//         }
//       }
//     }

//     // Check if scrap inventory exists for this purity
//     const scrapInventoryQuery = await conn.query(
//       `SELECT Id, Available_weight__c FROM Inventory_ledger__c 
//        WHERE Item_Name__c = 'Scrap' 
//        AND Purity__c = '91.7%'`
//     );

//     if (scrapReceivedWeight > 0) {
//       if (scrapInventoryQuery.records.length > 0) {
//         // Update existing scrap inventory
//         const currentWeight = scrapInventoryQuery.records[0].Available_weight__c || 0;
//         const scrapUpdateResult = await conn.sobject('Inventory_ledger__c').update({
//           Id: scrapInventoryQuery.records[0].Id,
//           Available_weight__c: currentWeight + scrapReceivedWeight,
//           Last_Updated__c: receivedDate
//         });

//         if (!scrapUpdateResult.success) {
//           throw new Error('Failed to update scrap inventory');
//         }
//       } else {
//         // Create new scrap inventory
//         const scrapCreateResult = await conn.sobject('Inventory_ledger__c').create({
//           Name: 'Scrap',
//           Item_Name__c: 'Scrap',
//           Purity__c: polishing.Purity__c,
//           Available_weight__c: scrapReceivedWeight,
//           Unit_of_Measure__c: 'Grams',
//           Last_Updated__c: receivedDate
//         });

//         if (!scrapCreateResult.success) {
//           throw new Error('Failed to create scrap inventory');
//         }
//       }
//     }

//     // Check if dust inventory exists
//     const dustInventoryQuery = await conn.query(
//       `SELECT Id, Available_weight__c FROM Inventory_ledger__c 
//        WHERE Item_Name__c = 'Dust' 
//        AND Purity__c = '91.7%'`
//     );

//     if (dustReceivedWeight > 0) {
//       if (dustInventoryQuery.records.length > 0) {
//         // Update existing dust inventory
//         const currentWeight = dustInventoryQuery.records[0].Available_weight__c || 0;
//         const dustUpdateResult = await conn.sobject('Inventory_ledger__c').update({
//           Id: dustInventoryQuery.records[0].Id,
//           Available_weight__c: currentWeight + dustReceivedWeight,
//           Last_Updated__c: receivedDate
//         });

//         if (!dustUpdateResult.success) {
//           throw new Error('Failed to update dust inventory');
//         }
//       } else {
//         // Create new dust inventory
//         const dustCreateResult = await conn.sobject('Inventory_ledger__c').create({
//           Name: 'Dust',
//           Item_Name__c: 'Dust',
//           Purity__c: polishing.Purity__c,
//           Available_weight__c: dustReceivedWeight,
//           Unit_of_Measure__c: 'Grams',
//           Last_Updated__c: receivedDate
//         });

//         if (!dustCreateResult.success) {
//           throw new Error('Failed to create dust inventory');
//         }
//       }
//     }

//     res.json({
//       success: true,
//       message: "Polishing record updated successfully",
//       data: {
//         polishingNumber,
//         receivedDate,
//         receivedWeight,
//         polishingLoss,
//         status: 'Finished'
//       }
//     });

//   } catch (error) {
//     console.error("[Polishing Update] Error:", error);
//     console.error("[Polishing Update] Full error details:", JSON.stringify(error, null, 2));
//     res.status(500).json({
//       success: false,
//       message: error.message || "Failed to update polishing record"
//     });
//   }
// });

/**-----------------Get all Polishing Details -----------------   connection changed   */
// app.get("/api/polishing-details/:prefix/:date/:month/:year/:number",checkMssqlConnection, async (req, res) => {
//   try {
//     const { prefix, date, month, year, number } = req.params;
//     const polishingId = `${prefix}/${date}/${month}/${year}/${number}`;
//  const pool = req.mssql;
//     // 1. Get Polishing details
//     const polishingQuery = await pool.request().query(
//       `SELECT 
//         Id,
//         Name,
//         Issued_Date_c,
//         Issued_Weight_c,
//         Received_Weight_c,
//         Received_Date_c,
//         Status_c,
//         Polishing_loss_c
//        FROM Polishing__c
//        WHERE Name = '${polishingId}'`
//     );

//     if (!polishingQuery.recordset || polishingQuery.recordset.length === 0) {
//       return res.status(404).json({
//         success: false,
//         message: "Polishing record not found"
//       });
//     }

//     const polishing = polishingQuery.recordset[0];

//     // 2. Get Pouches for this polishing
//     const pouchesQuery = await pool.request().query(
//       `SELECT 
//         Id,
//         Name,
//         Order_Id_c,
//         Issued_Weight_Polishing_c,
//         Received_Weight_Polishing_c
//        FROM Pouch__c 
//        WHERE Polishing__c = '${polishing.Id}'`
//     );

//     // 3. Get Orders for these pouches
//     const orderIds = pouchesQuery.recordset.map(pouch => `'${pouch.Order_Id__c}'`).join(',');
//     let orders = [];
//     let models = [];

//     if (orderIds.length > 0) {
//       const ordersQuery = await pool.request().query(
//         `SELECT 
//           Id,
//           Name,
//           Order_Id_c,
//           Party_Name_c,
//           Delivery_Date_c,
//           Status_c
//          FROM Order__c 
//          WHERE Order_Id_c IN (${orderIds})`
//       );
      
//       orders = ordersQuery.records;

//       // 4. Get Models for these orders
//       const orderIdsForModels = orders.map(order => `'${order.Id}'`).join(',');
//       if (orderIdsForModels.length > 0) {
//         const modelsQuery = await pool.request().query(
//           `SELECT 
//             Id,     
//             Name,
//             Order_c,
//             Category_c,
//             Purity_c,
//             Size_c,
//             Color_c,
//             Quantity_c,
//             Gross_Weight_c,
//             Stone_Weight_c,
//             Net_Weight_c
//            FROM Order_Models__c 
//            WHERE Order__c IN (${orderIdsForModels})`
//         );
        
//         models = modelsQuery.recordset;
//       }
//     }

//     const response = {
//       success: true,
//       data: {
//         polishing: polishing,
//         pouches: pouchesQuery.recordset.map(pouch => {
//           const relatedOrder = orders.find(order => order.Order_Id__c === pouch.Order_Id__c);
//           const pouchModels = relatedOrder ? models.filter(model => 
//             model.Order__c === relatedOrder.Id
//           ) : [];

//           return {
//             ...pouch,
//             order: relatedOrder || null,
//             models: pouchModels
//           };
//         })
//       },
//       summary: {
//         totalPouches: pouchesQuery.recordset.length,
//         totalOrders: orders.length,
//         totalModels: models.length,
//         totalPouchWeight: pouchesQuery.recordset.reduce((sum, pouch) => 
//               sum + (pouch.Issued_Weight_Polishing__c || 0), 0),
//         issuedWeight: polishing.Issued_Weight__c,
//         receivedWeight: polishing.Received_Weight__c,
//         polishingLoss: polishing.Polishing_loss__c
//       }
//     };

//     res.json(response);

//   } catch (error) {
//     console.error("Error fetching polishing details:", error);
//     console.error("Full error details:", JSON.stringify(error, null, 2));
//     res.status(500).json({
//       success: false,
//       message: error.message || "Failed to fetch polishing details"
//     });
//   }
// });


/**----------------- Get Pouches from Polishing -----------------   connection changed    */
// app.get("/api/polish/:prefix/:date/:month/:year/:number/:subnumber/pouches",checkMssqlConnection, async (req, res) => {
//   try {
//     const { prefix, date, month, year, number,subnumber } = req.params;
//     const polishingId = `${prefix}/${date}/${month}/${year}/${number}/${subnumber}`;
//     const pool = req.mssql;

//     console.log('[Get Pouches] Fetching pouches for polishing:', polishingId);

//     // First get the Polishing record
//     const polishingQuery = await pool.request().query(
//       `SELECT Id FROM Polishing__c WHERE Name = '${polishingId}'`
//     );

//     if (!polishingQuery.records || polishingQuery.records.length === 0) {
//       console.log('[Get Pouches] Polishing not found:', polishingId);
//       return res.status(404).json({
//         success: false,
//         message: "Polishing record not found"
//       });
//     }

//     // Get pouches with their IDs and issued weights
//     const pouchesQuery = await pool.request().query(
//       `SELECT 
//         Id, 
//         Name,
//         Issued_Weight_Polishing_c,
//         Received_Weight_Polishing_c,
//         Product_c,
//         Quantity_c,
//         Order_Id_c
//         FROM Pouch__c 
//        WHERE Polishing__c = '${polishingQuery.recordset[0].Id}'`
//     );

//     console.log('[Get Pouches] Found pouches:', pouchesQuery.recordset);

//     res.json({
//       success: true,
//       data: {
//         pouches: pouchesQuery.recordset
//       }
//     });

//   } catch (error) {
//     console.error("[Get Pouches] Error:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to fetch pouches"
//     });
//   }
// });

app.post("/api/dull/create", async (req, res) => {
  try {
    const { 
      dullId,
      issuedDate,
      pouches,
      totalWeight,
      status,
      product,
      quantity,
      orderId
    } = req.body;

    console.log('[Dull Create] Received data:', { 
      dullId,
      issuedDate,
      pouchCount: pouches.length,
      totalWeight,
      status
    });

    // First create the Dull record
    const dullResult = await conn.sobject('Dull__c').create({
      Name: dullId,
      Issued_Date__c: issuedDate,
      Issued_Weight__c: totalWeight,
      Status__c: status,
      Product__c : product,
      Quantity__c : quantity,
      Order_Id__c : orderId

    });

    console.log('[Dull Create] Dull record created:', dullResult);

    if (!dullResult.success) {
      throw new Error('Failed to create dull record');
    }

    // Update existing pouches
    const pouchResults = await Promise.all(pouches.map(async pouch => {
      console.log('[Dull Create] Updating pouch:', {
        pouchId: pouch.pouchId,
        weight: pouch.dullWeight
      });

      const pouchResult = await conn.sobject('Pouch__c').update({
        Id: pouch.pouchId,
        Dull__c: dullResult.id,
        Issued_Weight_Dull__c: pouch.dullWeight,
        Product__c : pouch.product,
        Quantity__c : pouch.quantity

      });

      console.log('[Dull Create] Pouch updated:', pouchResult);
      return pouchResult;
    }));

    res.json({
      success: true,
      message: "Dull record created successfully",
      data: {
        dullId: dullId,
        dullRecordId: dullResult.id,
        pouches: pouchResults
      }
    });


  } catch (error) {
    console.error("[Dull Create] Error:", error);
    console.error("[Dull Create] Full error details:", JSON.stringify(error, null, 2));
    res.status(500).json({
      success: false,
      message: error.message || "Failed to create dull record"
    });
  }
});

/**----------------- Get All Dull Records -----------------   connection changed    */
app.get("/api/dull",checkMssqlConnection, async (req, res) => {
  try {
    console.log('[Get Dull] Fetching all dull records');
const pool = req.mssql;
    const dullQuery = await pool.request().query(
      `SELECT 
        Id,
        Name,
        Issued_Date_c,
        Issued_Weight_c,
        	Returned_weight_c,
        Received_Date_c,
        status_c,
        Order_Id_c,
        Product_c,
        Quantity_c,
        Dull_loss_c,
        CreatedDate
       FROM Dull__c
       ORDER BY CreatedDate DESC`
    );

    console.log('[Get Dull] Found dull records:', dullQuery.recordset.length);

    res.json({
      success: true,
      data: dullQuery.recordset
    });

  } catch (error) {
    console.error("[Get Dull] Error:", error);
    console.error("[Get Dull] Full error details:", JSON.stringify(error, null, 2));
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch dull records"
    });
  }
});

/**----------------- Get Pouches for Dull -----------------   connection changed    */
app.get("/api/dull/:prefix/:date/:month/:year/:number/:subnumber/pouches",checkMssqlConnection, async (req, res) => {
  try {
    const { prefix, date, month, year, number, subnumber } = req.params;
    const dullId = `${prefix}/${date}/${month}/${year}/${number}/${subnumber}`;
    const pool = req.mssql;
    console.log('[Get Pouches] Fetching details for dull:', dullId);

    // First get the Dull record with all fields
    const dullQuery = await pool.request().query(
      `SELECT 
        Id,
        Name,
        Issued_Date_c,
        Issued_Weight_c,
        Returned_weight_c,
        Received_Date_c,
        Status_c,
        Dull_Loss_c
       FROM Dull__c 
       WHERE Name = '${dullId}'`
    );

    if (!dullQuery.recordset || dullQuery.recordset.length === 0) {
      console.log('[Get Pouches] Dull not found:', dullId);
      return res.status(404).json({
        success: false,
        message: "Dull record not found"
      });
    }

    // Get pouches with their IDs and weights
    const pouchesQuery = await pool.request().query(
      `SELECT 
        Id, 
        Name,
        Issued_Weight_Dull_c,
        Received_Weight_Dull_c,
        Quantity_c,
        Product_c,
        Order_Id_c
       FROM Pouch__c 
       WHERE Dull__c = '${dullQuery.recordset[0].Id}'`
    );

    console.log('[Get Pouches] Found pouches:', pouchesQuery.recordset);
    console.log('[Get Pouches] Dull details:', dullQuery.recordset[0]);

    res.json({
      success: true,
      data: {
        dull: dullQuery.recordset[0],
        pouches: pouchesQuery.recordset
      }
    });

  } catch (error) {
    console.error("[Get Pouches] Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch dull details"
    });
  }
});

/**-----------------Update Dull Received Weight ----------------- */
app.post("/api/dull/update/:prefix/:date/:month/:year/:number/:subnumber", async (req, res) => {
  try {
    const { prefix, date, month, year, number, subnumber } = req.params;
    const { receivedDate, receivedWeight, dullLoss, scrapReceivedWeight, dustReceivedWeight, ornamentWeight, pouches } = req.body;
    const dullNumber = `${prefix}/${date}/${month}/${year}/${number}/${subnumber}`;

    console.log('[Dull Update] Received data:', { 
      dullNumber, 
      receivedDate, 
      receivedWeight, 
      dullLoss,
      scrapReceivedWeight,
      dustReceivedWeight,
      ornamentWeight,
      pouches 
    });

    // First get the Dull record
    const dullQuery = await conn.query(
      `SELECT Id, Name FROM Dull__c WHERE Name = '${dullNumber}'`
    );

    if (!dullQuery.records || dullQuery.records.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Dull record not found"
      });
    }

    const dull = dullQuery.records[0];

    // Update the dull record
    const updateData = {
      Id: dull.Id,
      Received_Date__c: receivedDate,
      Returned_weight__c: receivedWeight,
      Dull_loss__c: dullLoss,
      Dull_Scrap_Weight__c: scrapReceivedWeight,
      Dull_Dust_Weight__c: dustReceivedWeight,
      Dull_Ornament_Weight__c: ornamentWeight,
      Status__c: 'Finished'
    };

    const updateResult = await conn.sobject('Dull__c').update(updateData);

    if (!updateResult.success) {
      throw new Error('Failed to update dull record');
    }

    // Update pouches if provided
    if (pouches && pouches.length > 0) {
      for (const pouch of pouches) {
        try {
          const pouchUpdateResult = await conn.sobject('Pouch__c').update({
            Id: pouch.pouchId,
            Received_Weight_Dull__c: pouch.receivedWeight,
            Dull_Loss__c: dullLoss
          });

          console.log(`[Dull Update] Pouch update result for ${pouch.pouchId}:`, pouchUpdateResult);
        } catch (pouchError) {
          console.error(`[Dull Update] Failed to update pouch ${pouch.pouchId}:`, pouchError);
          throw pouchError;
        }
      }
    }

    // Check if scrap inventory exists for this purity
    const scrapInventoryQuery = await conn.query(
      `SELECT Id, Available_weight__c FROM Inventory_ledger__c 
       WHERE Item_Name__c = 'Scrap' 
       AND Purity__c = '91.7%'`
    );

    if (scrapReceivedWeight > 0) {
      if (scrapInventoryQuery.records.length > 0) {
        // Update existing scrap inventory
        const currentWeight = scrapInventoryQuery.records[0].Available_weight__c || 0;
        const scrapUpdateResult = await conn.sobject('Inventory_ledger__c').update({
          Id: scrapInventoryQuery.records[0].Id,
          Available_weight__c: currentWeight + scrapReceivedWeight,
          Last_Updated__c: receivedDate
        });

        if (!scrapUpdateResult.success) {
          throw new Error('Failed to update scrap inventory');
        }
      } else {
        // Create new scrap inventory
        const scrapCreateResult = await conn.sobject('Inventory_ledger__c').create({
          Name: 'Scrap',
          Item_Name__c: 'Scrap',
          Purity__c: dull.Purity__c,
          Available_weight__c: scrapReceivedWeight,
          Unit_of_Measure__c: 'Grams',
          Last_Updated__c: receivedDate
        });

        if (!scrapCreateResult.success) {
          throw new Error('Failed to create scrap inventory');
        }
      }
    }

    // Check if dust inventory exists
    const dustInventoryQuery = await conn.query(
      `SELECT Id, Available_weight__c FROM Inventory_ledger__c 
       WHERE Item_Name__c = 'Dust' 
       AND Purity__c = '91.7%'`
    );

    if (dustReceivedWeight > 0) {
      if (dustInventoryQuery.records.length > 0) {
        // Update existing dust inventory
        const currentWeight = dustInventoryQuery.records[0].Available_weight__c || 0;
        const dustUpdateResult = await conn.sobject('Inventory_ledger__c').update({
          Id: dustInventoryQuery.records[0].Id,
          Available_weight__c: currentWeight + dustReceivedWeight,
          Last_Updated__c: receivedDate
        });

        if (!dustUpdateResult.success) {
          throw new Error('Failed to update dust inventory');
        }
      } else {
        // Create new dust inventory
        const dustCreateResult = await conn.sobject('Inventory_ledger__c').create({
          Name: 'Dust',
          Item_Name__c: 'Dust',
          Purity__c: dull.Purity__c,
          Available_weight__c: dustReceivedWeight,
          Unit_of_Measure__c: 'Grams',
          Last_Updated__c: receivedDate
        });

        if (!dustCreateResult.success) {
          throw new Error('Failed to create dust inventory');
        }
      }
    }

    res.json({
      success: true,
      message: "Dull record updated successfully",
      data: {
        dullNumber,
        receivedDate,
        receivedWeight,
        dullLoss,
        scrapReceivedWeight,
        dustReceivedWeight,
        ornamentWeight,
        status: 'Finished'
      }
    });

  } catch (error) {
    console.error("[Dull Update] Error:", error);
    console.error("[Dull Update] Full error details:", JSON.stringify(error, null, 2));
    res.status(500).json({
      success: false,
      message: error.message || "Failed to update dull record"
    });
  }
});

/**-----------------Get all Dull Details -----------------    connection changed   */
app.get("/api/dull-details/:prefix/:date/:month/:year/:number",checkMssqlConnection, async (req, res) => {
  try {
    const { prefix, date, month, year, number } = req.params;
    const dullId = `${prefix}/${date}/${month}/${year}/${number}`;
   const pool = req.mssql;
    // 1. Get Dull details
    const dullQuery = await pool.request().query(
      `SELECT 
        Id,
        Name,
        Issued_Date_c,
        Issued_Weight_c,
        Returned_weight_c,
        Received_Date_c,
        Status_c,
        Dull_loss_c
       FROM Dull__c
       WHERE Name = '${dullId}'`
    );

    if (!dullQuery.recordset || dullQuery.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Dull record not found"
      });
    }

    const dull = dullQuery.recordset[0];

    // 2. Get Pouches for this dull
    const pouchesQuery = await pool.request().query(
      `SELECT 
        Id,
        Name,
        Order_Id_c,
        Issued_Weight_Dull_c,
        Received_Weight_Dull_c
       FROM Pouch__c 
       WHERE Dull__c = '${dull.Id}'`
    );

    // 3. Get Orders for these pouches
    const orderIds = pouchesQuery.recordset.map(pouch => `'${pouch.Order_Id_c}'`).join(',');
    let orders = [];
    let models = [];

    if (orderIds.length > 0) {
      const ordersQuery = await pool.request().query(
        `SELECT 
          Id,
          Name,
          Order_Id_c,
          Party_Name_c,
          Delivery_Date_c,
          Status_c
         FROM Order__c 
         WHERE Order_Id_c IN (${orderIds})`
      );
      
      orders = ordersQuery.recordset;

      // 4. Get Models for these orders
      const orderIdsForModels = orders.map(order => `'${order.Id}'`).join(',');
      if (orderIdsForModels.length > 0) {
        const modelsQuery = await pool.request().query(
          `SELECT 
            Id,     
            Name,
            Order__c,
            Category__c,
            Purity__c,
            Size__c,
            Color__c,
            Quantity__c,
            Gross_Weight__c,
            Stone_Weight__c,
            Net_Weight__c
           FROM Order_Models__c 
           WHERE Order__c IN (${orderIdsForModels})`
        );
        
        models = modelsQuery.recordset;
      }
    }

    const response = {
      success: true,
      data: {
        dull: dull,
        pouches: pouchesQuery.recordset.map(pouch => {
          const relatedOrder = orders.find(order => order.Order_Id__c === pouch.Order_Id__c);
          const pouchModels = relatedOrder ? models.filter(model => 
            model.Order__c === relatedOrder.Id
          ) : [];

          return {
            ...pouch,
            order: relatedOrder || null,
            models: pouchModels
          };
        })
      },
      summary: {
        totalPouches: pouchesQuery.records.length,
        totalOrders: orders.length,
        totalModels: models.length,
        totalPouchWeight: pouchesQuery.records.reduce((sum, pouch) => 
              sum + (pouch.Issued_Weight_Dull__c || 0), 0),
        issuedWeight: dull.Issued_Weight__c,
        receivedWeight: dull.Returned_weight__c,
        dullLoss: dull.Dull_loss__c
      }
    };

    res.json(response);

  } catch (error) {
    console.error("Error fetching dull details:", error);
    console.error("Full error details:", JSON.stringify(error, null, 2));
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch dull details"
    });
  }
});

// ... existing code ...

/**----------------- Get Orders By Party ----------------- */







// /**----------------- Create Tagged Item ----------------- */
// app.post("/api/create-tagged-item", upload.single('pdf'), async (req, res) => {
//   try {
//     let pdfUrl = null;
    
//     if (req.file) {
//       // Create ContentVersion
//       const contentVersion = await conn.sobject('ContentVersion').create({
//         Title: `${req.body.taggingId}_${req.body.modelDetails}`,
//         PathOnClient: req.file.originalname,
//         VersionData: req.file.buffer.toString('base64'),
//         IsMajorVersion: true
//       });

//       // Get ContentDocumentId
//       const [versionDetails] = await conn.sobject('ContentVersion')
//         .select('Id, ContentDocumentId')
//         .where({ Id: contentVersion.id })
//         .execute();

//       // Create ContentDistribution
//       const distribution = await conn.sobject('ContentDistribution').create({
//         Name: `${req.body.taggingId}_${req.body.modelDetails}`,
//         ContentVersionId: contentVersion.id,
//         PreferencesAllowViewInBrowser: true,
//         PreferencesLinkLatestVersion: true,
//         PreferencesNotifyOnVisit: false,
//         PreferencesPasswordRequired: false,
//         PreferencesExpires: false
//       });

//       // Get Distribution URL
//       const [distributionDetails] = await conn.sobject('ContentDistribution')
//         .select('ContentDownloadUrl, DistributionPublicUrl')
//         .where({ Id: distribution.id })
//         .execute();

//       pdfUrl = distributionDetails.ContentDownloadUrl;
//     }

//     // Create Tagged Item
//     const taggedItem = {
//       Name: req.body.modelDetails,
//       Model_Unique_Number__c: req.body.modelUniqueNumber,
//       Gross_Weight__c: Number(req.body.grossWeight).toFixed(3),
//       Net_Weight__c: Number(req.body.netWeight).toFixed(3),
//       Stone_Weight__c: Number(req.body.stoneWeight).toFixed(3),
//       Stone_Charge__c: Number(req.body.stoneCharge),
//       model_details__c: pdfUrl,
//       Tagging_ID__c: req.body.taggingId
//     };

//     const result = await conn.sobject('Tagged_item__c').create(taggedItem);

//     // Send Response with URL
//     res.json({
//       success: true,
//       data: {
//         id: result.id,
//         taggingId: req.body.taggingId,
//         modelDetails: req.body.modelDetails,
//         modelUniqueNumber: req.body.modelUniqueNumber,
//         grossWeight: Number(req.body.grossWeight).toFixed(3),
//         netWeight: Number(req.body.netWeight).toFixed(3),
//         stoneWeight: Number(req.body.stoneWeight).toFixed(3),
//         stoneCharge: Number(req.body.stoneCharge),
//         pdfUrl: pdfUrl // Just send the URL directly
//       }
//     });

//   } catch (error) {
//     console.error('Error:', error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to create tagged item",
//       error: error.message
//     });
//   }
// });


/**----------------- Submit Tagging ----------------- */
// app.post("/api/submit-tagging", upload.fields([
//   { name: 'pdfFile', maxCount: 1 },
//   { name: 'excelFile', maxCount: 1 }
// ]), async (req, res) => {
//   try {
//     console.log('\n=== SUBMIT TAGGING REQUEST STARTED ===');
    
//     // Initialize URLs
//     let pdfUrl = null;
//     let excelUrl = null;

//     // 1. Extract all data from request
//     const { 
//       taggingId, 
//       partyCode, 
//       totalGrossWeight,
//       totalNetWeight,
//       totalStoneWeight,
//       totalStoneCharges
//     } = req.body;

//     console.log('Request Data:', { 
//       taggingId, 
//       partyCode, 
//       totalGrossWeight,
//       totalNetWeight,
//       totalStoneWeight,
//       totalStoneCharges
//     });

//     // 2. Process PDF file
//     if (req.files && req.files.pdfFile && req.files.pdfFile[0]) {
//       console.log('\nProcessing PDF file...');
//       const pdfFile = req.files.pdfFile[0];
      
//       try {
//         const contentVersion = await conn.sobject('ContentVersion').create({
//           Title: `${taggingId}_PDF`,
//           PathOnClient: pdfFile.originalname,
//           VersionData: pdfFile.buffer.toString('base64'),
//           IsMajorVersion: true
//         });
//         console.log('ContentVersion created:', contentVersion);

//         await new Promise(resolve => setTimeout(resolve, 2000));

//         const distribution = await conn.sobject('ContentDistribution').create({
//           Name: `${taggingId}_PDF`,
//           ContentVersionId: contentVersion.id,
//           PreferencesAllowViewInBrowser: true,
//           PreferencesLinkLatestVersion: true,
//           PreferencesNotifyOnVisit: false,
//           PreferencesPasswordRequired: false,
//           PreferencesExpires: false
//         });
//         console.log('ContentDistribution created:', distribution);

//         const [distributionDetails] = await conn.sobject('ContentDistribution')
//           .select('ContentDownloadUrl')
//           .where({ Id: distribution.id })
//           .execute();
        
//         pdfUrl = distributionDetails.ContentDownloadUrl;
//         console.log('PDF URL generated:', pdfUrl);
//       } catch (pdfError) {
//         console.error('Error processing PDF:', pdfError);
//         throw new Error(`PDF processing failed: ${pdfError.message}`);
//       }
//     }

//     // 3. Process Excel file
//     if (req.files && req.files.excelFile && req.files.excelFile[0]) {
//       console.log('\nProcessing Excel file...');
//       const excelFile = req.files.excelFile[0];
      
//       try {
//         const contentVersion = await conn.sobject('ContentVersion').create({
//           Title: `${taggingId}_Excel`,
//           PathOnClient: excelFile.originalname,
//           VersionData: excelFile.buffer.toString('base64'),
//           IsMajorVersion: true
//         });
//         console.log('ContentVersion created:', contentVersion);

//         await new Promise(resolve => setTimeout(resolve, 2000));

//         const distribution = await conn.sobject('ContentDistribution').create({
//           Name: `${taggingId}_Excel`,
//           ContentVersionId: contentVersion.id,
//           PreferencesAllowViewInBrowser: true,
//           PreferencesLinkLatestVersion: true,
//           PreferencesNotifyOnVisit: false,
//           PreferencesPasswordRequired: false,
//           PreferencesExpires: false
//         });
//         console.log('ContentDistribution created:', distribution);

//         const [distributionDetails] = await conn.sobject('ContentDistribution')
//           .select('ContentDownloadUrl')
//           .where({ Id: distribution.id })
//           .execute();
        
//         excelUrl = distributionDetails.ContentDownloadUrl;
//         console.log('Excel URL generated:', excelUrl);
//       } catch (excelError) {
//         console.error('Error processing Excel:', excelError);
//         throw new Error(`Excel processing failed: ${excelError.message}`);
//       }
//     }

//     // 4. Create Tagging record with all weights
//     console.log('\nCreating Tagging record with all details');
//     const taggingRecord = await conn.sobject('Tagging__c').create({
//       Name: taggingId,
//       Party_Name__c: partyCode,
//       Total_Gross_Weight__c: Number(totalGrossWeight),
//       Total_Net_Weight__c: Number(totalNetWeight),
//       Total_Stone_Weight__c: Number(totalStoneWeight),
//       Total_Stone_Charges__c: Number(totalStoneCharges),
//       Pdf__c: pdfUrl,
//       Excel_sheet__c: excelUrl,
//       Created_Date__c: new Date().toISOString()
//     });

//     console.log('Tagging record created:', taggingRecord);

//     // 5. Update Tagged Items
//     const taggedItems = await conn.sobject('Tagged_item__c')
//       .find({ Tagging_ID__c: taggingId })
//       .update({ 
//         Tagging__c: taggingRecord.id 
//       });

//     console.log('Updated Tagged Items:', taggedItems);

//     // 6. Send Response with all weights
//     res.json({
//       success: true,
//       data: {
//         id: taggingRecord.id,
//         taggingId: taggingId,
//         partyCode: partyCode,
//         totalGrossWeight: totalGrossWeight,
//         totalNetWeight: totalNetWeight,
//         totalStoneWeight: totalStoneWeight,
//         totalStoneCharges: totalStoneCharges,
//         pdfUrl: pdfUrl,
//         excelUrl: excelUrl,
//         updatedItems: taggedItems.length
//       }
//     });

//   } catch (error) {
//     console.error('\n=== ERROR DETAILS ===');
//     console.error('Error:', error);
//     console.error('Stack:', error.stack);
//     res.status(500).json({
//       success: false,
//       message: "Failed to submit tagging",
//       error: error.message,
//       details: {
//         files: req.files ? Object.keys(req.files) : [],
//         body: req.body
//       }
//     });
//   }
// });



/**----------------- Get Tagging Details -----------------    connection changed    /  table created  */
// app.get("/api/tagging-details/:taggingId",checkMssqlConnection, async (req, res) => {
//   try {
    
//     const pool = req.mssql;

//     const { taggingId } = req.params;
//     console.log('\n=== FETCHING TAGGING DETAILS ===');
//     console.log('Tagging ID:', taggingId);

//     // 1. Get Tagging record
//     const taggingQuery = await pool.request().query(
//       `SELECT 
//         Id,
//         Name,
//         Party_Name_c,
//         Total_Gross_Weight_c,
//         Total_Net_Weight_c,
//         Total_Stone_Weight_c,
//         Total_Stone_Charges_c,
//         Pdf_c,
//         Excel_sheet_c,
//         Created_Date_c
//        FROM Tagging__c 
//        WHERE Name = '${taggingId}'`
//     );

//     if (!taggingQuery.recordset || taggingQuery.recordset.length === 0) {
//       return res.status(404).json({
//         success: false,
//         message: "Tagging record not found"
//       });
//     }

//     // 2. Get Tagged Items
//     const taggedItemsQuery = await conn.query(
//       `SELECT 
//         Id,
//         Name,
//         model_details_c,
//         Model_Unique_Number_c,
//         Gross_Weight_c,
//         Net_Weight_c,
//         Stone_Weight_c,
//         Stone_Charge_c
//        FROM Tagged_item__c 
//        WHERE Tagging__c = '${taggingQuery.recordset[0].Id}'`
//     );

//     // 3. Prepare response
//     const response = {
//       success: true,
//       data: {
//         tagging: {
//           id: taggingQuery.recordset[0].Id,
//           taggingId: taggingQuery.recordset[0].Name,
//           partyCode: taggingQuery.recordset[0].Party_Name__c,
//           totalGrossWeight: taggingQuery.recordset[0].Total_Gross_Weight__c,
//           totalNetWeight: taggingQuery.recordset[0].Total_Net_Weight__c,
//           totalStoneWeight: taggingQuery.recordset[0].Total_Stone_Weight__c,
//           totalStoneCharges: taggingQuery.recordset[0].Total_Stone_Charges__c,
//           pdfUrl: taggingQuery.recordset[0].Pdf__c,
//           excelUrl: taggingQuery.recordset[0].Excel_sheet__c,
//           createdDate: taggingQuery.recordset[0].Created_Date__c
//         },
//         taggedItems: taggedItemsQuery.recordset.map(item => ({
//           id: item.Id,
//           name: item.Name,
//           modelUniqueNumber: item.Model_Unique_Number__c,
//           grossWeight: item.Gross_Weight__c,
//           netWeight: item.Net_Weight__c,
//           stoneWeight: item.Stone_Weight__c,
//           stoneCharge: item.Stone_Charge__c,
//           pdfUrl: item.model_details__c
//         })),
//         summary: {
//           totalItems: taggedItemsQuery.recordset.length,
//           totalGrossWeight: taggedItemsQuery.recordset.reduce((sum, item) => 
//             sum + (item.Gross_Weight__c || 0), 0
//           ),
//           totalNetWeight: taggedItemsQuery.recordset.reduce((sum, item) => 
//             sum + (item.Net_Weight__c || 0), 0
//           ),
//           totalStoneWeight: taggedItemsQuery.recordset.reduce((sum, item) => 
//             sum + (item.Stone_Weight__c || 0), 0
//           )
//         }
//       }
//     };

//     console.log('Sending response with:', {
//       taggingFound: true,
//       itemsCount: taggedItemsQuery.recordset.length,
//       hasPDF: !!taggingQuery.recordset[0].Pdf__c,
//       hasExcel: !!taggingQuery.recordset[0].Excel_sheet__c
//     });

//     res.json(response);

//   } catch (error) {
//     console.error('\n=== ERROR DETAILS ===');
//     console.error('Error:', error);
//     console.error('Stack:', error.stack);
//     res.status(500).json({
//       success: false,
//       message: "Failed to fetch tagging details",
//       error: error.message
//     });
//   }
// });



/**----------------- Get Party Ledger Details -----------------   connection changed  / */
app.get("/api/partyledger/:partyCode",checkMssqlConnection, async (req, res) => {
  try {
    const pool = req.mssql;
    const { partyCode } = req.params;
    console.log('\n=== FETCHING PARTY LEDGER DETAILS ===');
    console.log('Party Code:', partyCode);

    // Query Party_Ledger__c object
    const query = await pool.request().query(
      `SELECT 
        Id,
        Name,
        Party_Code_c,
        Address_c,
        Gst_c,
        Pan_Card_c
       FROM Party_Ledger__c 
       WHERE Party_Code_c = '${partyCode}'`
    );

    if (!query.recordset || query.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Party not found"
      });
    }

    const partyDetails = {
      id: query.recordset[0].Id,
      partyCode: query.recordset[0].Party_Code__c,
      partyName: query.recordset[0].Name,
      address: query.recordset[0].Address__c,
      gstNo: query.recordset[0].Gst__c,
      panNo: query.recordset[0].Pan_Card__c
    };

    console.log('Party details found:', partyDetails);

    res.json({
      success: true,
      data: partyDetails
    });

  } catch (error) {
    console.error('\n=== ERROR DETAILS ===');
    console.error('Error:', error);
    console.error('Stack:', error.stack);
    res.status(500).json({
      success: false,
      message: "Failed to fetch party details",
      error: error.message
    });
  }
});
/**----------------- Submit Billing ----------------- */
app.post("/api/billing/submit", upload.fields([
  { name: 'taxInvoicePdf', maxCount: 1 },
  { name: 'deliveryChallanPdf', maxCount: 1 }
]), async (req, res) => {
  try {
    console.log('\n=== SUBMIT BILLING REQUEST STARTED ===');
    
    // 1. Extract data from request
    const { 
      billingId, 
      taggingId, 
      partyName, 
      goldRate,
      invoiceNumber,
      invoiceDate,
      totalFineWeight
    } = req.body;

    console.log('Request Data:', { 
      billingId, 
      taggingId, 
      partyName, 
      goldRate,
      invoiceNumber,
      invoiceDate 
    });

    // 2. Initialize URLs
    let taxInvoiceUrl = null;
    let deliveryChallanUrl = null;

    // 3. Process Tax Invoice PDF
    if (req.files && req.files.taxInvoicePdf) {
      const pdfFile = req.files.taxInvoicePdf[0];
      
      const contentVersion = await conn.sobject('ContentVersion').create({
        Title: `${billingId}_TaxInvoice`,
        PathOnClient: pdfFile.originalname,
        VersionData: pdfFile.buffer.toString('base64'),
        IsMajorVersion: true
      });

      const distribution = await conn.sobject('ContentDistribution').create({
        Name: `${billingId}_TaxInvoice`,
        ContentVersionId: contentVersion.id,
        PreferencesAllowViewInBrowser: true,
        PreferencesLinkLatestVersion: true,
        PreferencesNotifyOnVisit: false,
        PreferencesPasswordRequired: false,
        PreferencesExpires: false
      });

      const [distributionDetails] = await conn.sobject('ContentDistribution')
        .select('ContentDownloadUrl')
        .where({ Id: distribution.id })
        .execute();
      
      taxInvoiceUrl = distributionDetails.ContentDownloadUrl;
    }

    // 4. Process Delivery Challan PDF
    if (req.files && req.files.deliveryChallanPdf) {
      const pdfFile = req.files.deliveryChallanPdf[0];
      
      const contentVersion = await conn.sobject('ContentVersion').create({
        Title: `${billingId}_DeliveryChallan`,
        PathOnClient: pdfFile.originalname,
        VersionData: pdfFile.buffer.toString('base64'),
        IsMajorVersion: true
      });

      const distribution = await conn.sobject('ContentDistribution').create({
        Name: `${billingId}_DeliveryChallan`,
        ContentVersionId: contentVersion.id,
        PreferencesAllowViewInBrowser: true,
        PreferencesLinkLatestVersion: true,
        PreferencesNotifyOnVisit: false,
        PreferencesPasswordRequired: false,
        PreferencesExpires: false
      });

      const [distributionDetails] = await conn.sobject('ContentDistribution')
        .select('ContentDownloadUrl')
        .where({ Id: distribution.id })
        .execute();
      
      deliveryChallanUrl = distributionDetails.ContentDownloadUrl;
    }

    // 5. Create Billing record
    const billingRecord = await conn.sobject('Billing__c').create({
      Name: billingId,
      Tagging_id__c: taggingId,
      Party_Name__c: partyName,
      Gold_Rate__c: Number(goldRate),
      Invoice_Number__c: invoiceNumber,
      Invoice_Date__c: invoiceDate,
      Tax_Invoice_URL__c: taxInvoiceUrl,
      Total_Net_Weight__c : Number(totalFineWeight),
      Delivery_Challan_URL__c: deliveryChallanUrl,
      Created_Date__c: new Date().toISOString()
    });

    console.log('Billing record created:', billingRecord);

    // 6. Send Response
    res.json({
      success: true,
      data: {
        id: billingRecord.id,
        billingId: billingId,
        taggingId: taggingId,
        partyName: partyName,
        goldRate: goldRate,
        totalFineWeight: totalFineWeight,
        invoiceNumber: invoiceNumber,
        invoiceDate: invoiceDate,
        taxInvoiceUrl: taxInvoiceUrl,
        deliveryChallanUrl: deliveryChallanUrl
      }
    });

  } catch (error) {
    console.error('\n=== ERROR DETAILS ===');
    console.error('Error:', error);
    console.error('Stack:', error.stack);
    res.status(500).json({
      success: false,
      message: "Failed to submit billing",
      error: error.message,
      details: {
        files: req.files ? Object.keys(req.files) : [],
        body: req.body
      }
    });
  }
});

/**----------------- Get All Billing Details -----------------    connection chnaged  /    table created */
app.get("/api/billing",checkMssqlConnection, async (req, res) => {
  try {
    console.log('\n=== FETCHING ALL BILLING DETAILS ===');

    const pool = req.mssql;
    // Query Billing__c records
    const billingQuery = await pool.request().query(
      `SELECT 
        Id,
        Name,
        Party_Name_c,
        Created_Date_c,
        Total_Net_Weight_c,
        Delivery_Challan_URL_c,
        Tax_Invoice_URL_c
       FROM Billing__c
       ORDER BY Created_Date_c DESC`
    );

    if (!billingQuery.recordset || billingQuery.recordset.length === 0) {
      return res.json({
        success: true,
        data: []
      });
    }

    // Map the records to the desired format
    const billings = billingQuery.recordset.map(record => ({
      id: record.Name,
      PartyName: record.Party_Name__c || '',
      createdDate: record.Created_Date__c || '',
      totalFineWeight: record.Total_Net_Weight__c || 0,
      DeliveryChallanUrl: record.Delivery_Challan_URL__c || '',
      TaxInvoiceUrl: record.Tax_Invoice_URL__c || ''
    }));

    console.log(`Found ${billings.length} billing records`);

    res.json({
      success: true,
      data: billings
    });

  } catch (error) {
    console.error('\n=== ERROR DETAILS ===');
    console.error('Error:', error);
    console.error('Stack:', error.stack);
    res.status(500).json({
      success: false,
      message: "Failed to fetch billing details",
      error: error.message
    });
  }
});



/**----------------- Get All Department Losses -----------------    connection chnaged  /    */
app.get("/api/department-losses",checkMssqlConnection, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const pool = req.mssql;

    console.log('\n=== FETCHING ALL DEPARTMENT LOSSES ===');
    console.log('Date Range:', { startDate, endDate });

    // Validate date parameters
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "Both startDate and endDate are required"
      });
    }

    // Format dates for SOQL query (exact Salesforce datetime format)
    const formatSalesforceDatetime = (dateStr, isEndDate = false) => {
      const date = new Date(dateStr);
      if (isEndDate) {
        // Set to end of day (23:59:59)
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T23:59:59Z`;
      }
      // Start of day (00:00:00)
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T00:00:00Z`;
    };

    // Format dates for display
    const formatDisplayDateTime = (dateStr) => {
      if (!dateStr) return '';
      const date = new Date(dateStr);
      return date.toLocaleString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    };

    const formattedStartDate = formatSalesforceDatetime(startDate);
    const formattedEndDate = formatSalesforceDatetime(endDate, true);

    console.log('Formatted dates:', { formattedStartDate, formattedEndDate });

    // Query all departments with datetime comparison
    const [castingQuery, filingQuery, grindingQuery, settingQuery, polishingQuery] = await Promise.all([
      // Casting
      pool.request().query(
        `SELECT Id, Name, Issued_Date_c, Received_Date_c, Issud_weight_c, Weight_Received_c, Casting_Loss_c 
         FROM Casting_dept__c 
         WHERE Issued_Date_c >= ${formattedStartDate}
         AND Issued_Date_c <= ${formattedEndDate}
         AND Status_c = 'Finished'`
      ),
      // Filing
      pool.request().query(
        `SELECT Id, Name, Issued_Date_c, Received_Date_c, Issued_weight_c, Receievd_weight_c, Filing_loss_c 
         FROM Filing__c 
         WHERE Issued_Date_c >= ${formattedStartDate}
         AND Issued_Date_c <= ${formattedEndDate}
         AND Status_c = 'Finished'`
      ),
      // Grinding
      pool.request().query(
        `SELECT Id, Name, Issued_Date_c, Received_Date_c, Issued_Weight_c, Received_Weight_c, Grinding_loss_c 
         FROM Grinding__c 
         WHERE Issued_Date_c >= ${formattedStartDate}
         AND Issued_Date_c <= ${formattedEndDate}
         AND Status_c = 'Finished'`
      ),
      // Setting
      pool.request().query(
        `SELECT Id, Name, Issued_Date_c, Received_Date_c, Issued_Weight_c, Returned_weight_c, Setting_l_c 
         FROM Setting__c 
         WHERE Issued_Date_c >= ${formattedStartDate}
         AND Issued_Date_c <= ${formattedEndDate}
         AND Status_c = 'Finished'`
      ),
      // Polishing
      pool.request().query(
        `SELECT Id, Name, Issued_Date_c, Received_Date_c, Issued_Weight_c, Received_Weight_c, Polishing_loss_c 
         FROM Polishing__c 
         WHERE Issued_Date_c >= ${formattedStartDate}
         AND Issued_Date_c <= ${formattedEndDate}
         AND Status_c = 'Finished'`
      )
    ]);

    const response = {
      success: true,
      data: {
        casting: castingQuery.recordset.map(record => ({
          id: record.Name,
          issuedDate: formatDisplayDateTime(record.Issued_Date__c),
          receivedDate: formatDisplayDateTime(record.Received_Date__c),
          issuedWeight: record.Issud_weight__c || 0,
          receivedWeight: record.Weight_Received__c || 0,
          loss: record.Casting_Loss__c || 0
        })),
        filing: filingQuery.recordset.map(record => ({
          id: record.Name,
          issuedDate: formatDisplayDateTime(record.Issued_Date__c),
          receivedDate: formatDisplayDateTime(record.Received_Date__c),
          issuedWeight: record.Issued_weight__c || 0,
          receivedWeight: record.Receievd_weight__c || 0,
          loss: record.Filing_loss__c || 0
        })),
        grinding: grindingQuery.recordset.map(record => ({
          id: record.Name,
          issuedDate: formatDisplayDateTime(record.Issued_Date__c),
          receivedDate: formatDisplayDateTime(record.Received_Date__c),
          issuedWeight: record.Issued_Weight__c || 0,
          receivedWeight: record.Received_Weight__c || 0,
          loss: record.Grinding_loss__c || 0
        })),
        setting: settingQuery.recordset.map(record => ({
          id: record.Name,
          issuedDate: formatDisplayDateTime(record.Issued_Date__c),
          receivedDate: formatDisplayDateTime(record.Received_Date__c),
          issuedWeight: record.Issued_Weight__c || 0,
          receivedWeight: record.Returned_weight__c || 0,
          loss: record.Setting_l__c || 0
        })),
        polishing: polishingQuery.recordset.map(record => ({
          id: record.Name,
          issuedDate: formatDisplayDateTime(record.Issued_Date__c),
          receivedDate: formatDisplayDateTime(record.Received_Date__c),
          issuedWeight: record.Issued_Weight__c || 0,
          receivedWeight: record.Received_Weight__c || 0,
          loss: record.Polishing_loss__c || 0
        }))
      },
      summary: {
        totalCastingLoss: castingQuery.recordset.reduce((sum, record) => sum + (record.Casting_Loss__c || 0), 0),
        totalFilingLoss: filingQuery.recordset.reduce((sum, record) => sum + (record.Filing_loss__c || 0), 0),
        totalGrindingLoss: grindingQuery.recordset.reduce((sum, record) => sum + (record.Grinding_loss__c || 0), 0),
        totalSettingLoss: settingQuery.recordset.reduce((sum, record) => sum + (record.Setting_l__c || 0), 0),
        totalPolishingLoss: polishingQuery.recordset.reduce((sum, record) => sum + (record.Polishing_loss__c || 0), 0),
        totalOverallLoss: 
          castingQuery.recordset.reduce((sum, record) => sum + (record.Casting_Loss__c || 0), 0) +
          filingQuery.recordset.reduce((sum, record) => sum + (record.Filing_loss__c || 0), 0) +
          grindingQuery.recordset.reduce((sum, record) => sum + (record.Grinding_loss__c || 0), 0) +
          settingQuery.recordset.reduce((sum, record) => sum + (record.Setting_l__c || 0), 0) +
          polishingQuery.recordset.reduce((sum, record) => sum + (record.Polishing_loss__c || 0), 0)
      }
    };

    console.log('Response Summary:', response.summary);
    res.json(response);

  } catch (error) {
    console.error('\n=== ERROR DETAILS ===');
    console.error('Error:', error);
    console.error('Stack:', error.stack);
    res.status(500).json({
      success: false,
      message: "Failed to fetch department losses",
      error: error.message
    });
  }
});

/**----------------- Get Pouches for Grinding by Date -----------------  */
// app.get("/api/grinding/pouches/:date/:month/:year/:number",checkMssqlConnection, async (req, res) => {
//   try {
//     const { date, month, year, number } = req.params;    
//     const pool = req.mssql;

//     console.log('[Get Grinding Pouches] Received params:', { date, month, year, number });

//     // Ensure consistent formatting with padded zeros
//     const paddedDate = String(date).padStart(2, '0');
//     const paddedMonth = String(month).padStart(2, '0');
//     const paddedNumber = String(number).padStart(2, '0');
//     const grindingId = `${paddedDate}/${paddedMonth}/${year}/${paddedNumber}`;
    
//     console.log('[Get Grinding Pouches] Formatted grinding ID:', grindingId);

//     // Debug query to see what records exist
//     const debugQuery = await pool.request().query(
//       `SELECT Id, Name 
//        FROM Grinding__c 
//        WHERE Name LIKE '%${paddedMonth}/${year}/${paddedNumber}'`
//     );
//     console.log('[Get Grinding Pouches] Available grinding records:', debugQuery.recordset);

//     // Get the specific grinding record
//     const grindingQuery = await pool.request().query(
//       `SELECT Id, Name 
//        FROM Grinding__c 
//        WHERE Name = '${grindingId}'`
//     );
//     console.log('[Get Grinding Pouches] Exact match result:', grindingQuery.recordset);

//     if (!grindingQuery.recordset || grindingQuery.recordset.length === 0) {
//       return res.status(404).json({
//         success: false,
//         message: "Grinding record not found",
//         debug: {
//           searchedId: grindingId,
//           availableRecords: debugQuery.records.map(r => r.Name)
//         }
//       });
//     }

//     const grindingRecord = grindingQuery.recordset[0];
//     console.log('[Get Grinding Pouches] Found grinding record:', grindingRecord);

//     // Get associated pouches
//     const pouchesQuery = await pool.request().query(
//       `SELECT 
//         Id, 
//         Name,
//         Order_Id__c,
//         Isssued_Weight_Grinding_c,
//         Received_Weight_Grinding_c
//        FROM Pouch__c 
//        WHERE Grinding_c = '${grindingRecord.Id}'`
//     );
//     console.log('[Get Grinding Pouches] Found pouches count:', pouchesQuery.recordset.length);

//     // Get related order details
//     const orderIds = [...new Set(pouchesQuery.recordset
//       .map(pouch => pouch.Order_Id__c)
//       .filter(id => id))];

//     let orderDetails = [];
//     if (orderIds.length > 0) {
//       const orderQuery = await pool.request().query(
//         `SELECT Id, Order_Id_c, Party_Name_c
//          FROM Order__c 
//          WHERE Order_Id_c IN ('${orderIds.join("','")}')`
//       );
//       orderDetails = orderQuery.recordset;
//     }

//     // Combine pouch and order information
//     const pouchesWithDetails = pouchesQuery.recordset.map(pouch => {
//       const relatedOrder = orderDetails.find(order => order.Order_Id__c === pouch.Order_Id__c);
//       return {
//         ...pouch,
//         partyName: relatedOrder ? relatedOrder.Party_Name__c : null,
//         orderNumber: pouch.Order_Id__c
//       };
//     });

//     res.json({
//       success: true,
//       data: {
//         grindingId: grindingId,
//         pouches: pouchesWithDetails
//       },
//       summary: {
//         totalPouches: pouchesWithDetails.length,
//         totalWeight: pouchesWithDetails.reduce((sum, pouch) => 
//           sum + (pouch.Isssued_Weight_Grinding__c || 0), 0)
//       }
//     });

//   } catch (error) {
//     console.error("[Get Grinding Pouches] Error:", error);
//     console.error("[Get Grinding Pouches] Stack:", error.stack);
//     res.status(500).json({
//       success: false,
//       message: "Failed to fetch pouches for grinding",
//       error: error.message
//     });
//   }
// });


/**----------------- Get Pouches for Grinding by Date -----------------  */
app.post("/api/grinding-record/create", async (req, res) => {
  try {
    const { 
      grindingId,  
      issuedWeight, 
      issuedDate, 
      pouches,
      orderId,
      quantity,
      name
        
    } = req.body;

    console.log('Creating Grinding record:', { 
      grindingId,  
      issuedWeight, 
      issuedDate 
    });

    // First create the Grinding record
    const grindingResult = await conn.sobject('Grinding__c').create({
      Name: grindingId,
      Issued_Weight__c: issuedWeight,
      Issued_Date__c: issuedDate,
      Status__c: 'In progress',
      Product__C : name,
      Order_Id__c: orderId,
      Quantity__c : quantity

    });

    console.log('Grinding creation result:', grindingResult);

    if (!grindingResult.success) {
      throw new Error('Failed to create grinding record');
    }

    // Create WIP pouches
    const pouchRecords = pouches.map(pouch => ({
      Name: pouch.pouchId,
      Grinding__c: grindingResult.id,
      Order_Id__c: pouch.orderId,
      Isssued_Weight_Grinding__c: pouch.weight,
      Product__c : pouch.name,
      Quantity__c: pouch.quantity
    }));

    console.log('Creating pouches:', pouchRecords);

    const pouchResults = await conn.sobject('Pouch__c').create(pouchRecords);
    console.log('Pouch creation results:', pouchResults);

    // Add this section to create pouch items with clear logging
    if (Array.isArray(pouchResults)) {
      console.log('Starting pouch items creation...');
      
      const pouchItemPromises = pouchResults.map(async (pouchResult, index) => {
        console.log(`Processing pouch ${index + 1}:`, pouchResult);
        
        if (pouches[index].categories && pouches[index].categories.length > 0) {
          console.log(`Found ${pouches[index].categories.length} categories for pouch ${index + 1}`);
          
          const pouchItemRecords = pouches[index].categories.map(category => {
            const itemRecord = {
              Name: category.category,
              WIPPouch__c: pouchResult.id,
              Category__c: category.category,
              Quantity__c: category.quantity
            };
            console.log('Creating pouch item:', itemRecord);
            return itemRecord;
          });

          try {
            console.log(`Attempting to create ${pouchItemRecords.length} pouch items`);
            const itemResults = await conn.sobject('Pouch_Items__c').create(pouchItemRecords);
            
            if (Array.isArray(itemResults)) {
              itemResults.forEach((result, i) => {
                if (result.success) {
                  console.log(`Pouch item ${i + 1} created successfully:`, result);
                } else {
                  console.error(`Pouch item ${i + 1} creation failed:`, result.errors);
                }
              });
            } else {
              if (itemResults.success) {
                console.log('Single pouch item created successfully:', itemResults);
              } else {
                console.error('Single pouch item creation failed:', itemResults.errors);
              }
            }
            
            return itemResults;
          } catch (error) {
            console.error('Error in pouch items creation:', error.message);
            console.error('Full error:', error);
            throw error;
          }
        } else {
          console.log(`No categories found for pouch ${index + 1}`);
        }
      });

      console.log('Waiting for all pouch items to be created...');
      const pouchItemResults = await Promise.all(pouchItemPromises);
      console.log('All pouch items creation completed:', pouchItemResults);
    }

    res.json({
      success: true,
      message: "Grinding record created successfully",
      data: {
        grindingId,
        grindingRecordId: grindingResult.id,
        pouches: pouchResults
      }
    });

  } catch (error) {
    console.error("Error creating grinding record:", error);
    console.error("Full error details:", JSON.stringify(error, null, 2));
    res.status(500).json({
      success: false,
      message: error.message || "Failed to create grinding record"
    });
  }
});

/**----------------- Get Pouches for Grinding by Date -----------------  */

app.post("/api/setting-record/create", async (req, res) => {
  try {
    const { 
      settingId,  
      issuedWeight, 
      issuedDate, 
      pouches,
      orderId,
      quantity,
      name  
    } = req.body;

    console.log('Creating Setting record:', { 
      settingId,  
      issuedWeight, 
      issuedDate 
    });

    // First create the Setting record
    const settingResult = await conn.sobject('Setting__c').create({
      Name: settingId,
      Issued_Weight__c: issuedWeight,
      Issued_Date__c: issuedDate,
      Status__c: 'In progress',
      Product__C : name,
      Order_Id__c: orderId,
      Quantity__c : quantity
    });

    console.log('Setting creation result:', settingResult);

    if (!settingResult.success) {
      throw new Error('Failed to create setting record');
    }

    // Create WIP pouches
    const pouchRecords = pouches.map(pouch => ({
      Name: pouch.pouchId,
      Setting__c: settingResult.id,
      Order_Id__c: pouch.orderId,
      Issued_Weight_Setting__c: pouch.weight,
      Product__c : pouch.name,
      Quantity__c: pouch.quantity
    }));

    console.log('Creating pouches:', pouchRecords);

    const pouchResults = await conn.sobject('Pouch__c').create(pouchRecords);
    console.log('Pouch creation results:', pouchResults);

    // Add this section to create pouch items with clear logging
    if (Array.isArray(pouchResults)) {
      console.log('Starting pouch items creation...');
      
      const pouchItemPromises = pouchResults.map(async (pouchResult, index) => {
        console.log(`Processing pouch ${index + 1}:`, pouchResult);
        
        if (pouches[index].categories && pouches[index].categories.length > 0) {
          console.log(`Found ${pouches[index].categories.length} categories for pouch ${index + 1}`);
          
          const pouchItemRecords = pouches[index].categories.map(category => {
            const itemRecord = {
              Name: category.category,
              WIPPouch__c: pouchResult.id,
              Category__c: category.category,
              Quantity__c: category.quantity
            };
            console.log('Creating pouch item:', itemRecord);
            return itemRecord;
          });

          try {
            console.log(`Attempting to create ${pouchItemRecords.length} pouch items`);
            const itemResults = await conn.sobject('Pouch_Items__c').create(pouchItemRecords);
            
            if (Array.isArray(itemResults)) {
              itemResults.forEach((result, i) => {
                if (result.success) {
                  console.log(`Pouch item ${i + 1} created successfully:`, result);
                } else {
                  console.error(`Pouch item ${i + 1} creation failed:`, result.errors);
                }
              });
            } else {
              if (itemResults.success) {
                console.log('Single pouch item created successfully:', itemResults);
              } else {
                console.error('Single pouch item creation failed:', itemResults.errors);
              }
            }
            
            return itemResults;
          } catch (error) {
            console.error('Error in pouch items creation:', error.message);
            console.error('Full error:', error);
            throw error;
          }
        } else {
          console.log(`No categories found for pouch ${index + 1}`);
        }
      });

      console.log('Waiting for all pouch items to be created...');
      const pouchItemResults = await Promise.all(pouchItemPromises);
      console.log('All pouch items creation completed:', pouchItemResults);
    }

    res.json({
      success: true,
      message: "Setting record created successfully",
      data: {
        settingId,
        settingRecordId: settingResult.id,
        pouches: pouchResults
      }
    });

  } catch (error) {
    console.error("Error creating setting record:", error);
    console.error("Full error details:", JSON.stringify(error, null, 2));
    res.status(500).json({
      success: false,
      message: error.message || "Failed to create setting record"
    });
  }
});


/**----------------- Get Pouches for Grinding by Date -----------------    */
app.post("/api/polishing-record/create", async (req, res) => {
  try {
    const { 
      polishingId,  
      issuedWeight, 
      issuedDate, 
      pouches,
      orderId,
      quantity,
      name    
    } = req.body;

    console.log('Creating Polishing record:', { 
      polishingId,  
      issuedWeight, 
      issuedDate 
    });

    // First create the Polishing record
    const polishingResult = await conn.sobject('Polishing__c').create({
      Name: polishingId,
      Issued_Weight__c: issuedWeight,
      Issued_Date__c: issuedDate,
      Status__c: 'In progress',
      Product__C : name,
      Order_Id__c: orderId,
      Quantity__c : quantity
    });

    console.log('Polishing creation result:', polishingResult);

    if (!polishingResult.success) {
      throw new Error('Failed to create polishing record');
    }

    // Create WIP pouches
    const pouchRecords = pouches.map(pouch => ({
      Name: pouch.pouchId,
      Polishing__c: polishingResult.id,
      Order_Id__c: pouch.orderId,
      Issued_Weight_Polishing__c: pouch.weight,
      Product__c : pouch.name,
      Quantity__c: pouch.quantity
    }));

    console.log('Creating pouches:', pouchRecords);

    const pouchResults = await conn.sobject('Pouch__c').create(pouchRecords);
    console.log('Pouch creation results:', pouchResults);

    // Add this section to create pouch items with clear logging
    if (Array.isArray(pouchResults)) {
      console.log('Starting pouch items creation...');
      
      const pouchItemPromises = pouchResults.map(async (pouchResult, index) => {
        console.log(`Processing pouch ${index + 1}:`, pouchResult);
        
        if (pouches[index].categories && pouches[index].categories.length > 0) {
          console.log(`Found ${pouches[index].categories.length} categories for pouch ${index + 1}`);
          
          const pouchItemRecords = pouches[index].categories.map(category => {
            const itemRecord = {
              Name: category.category,
              WIPPouch__c: pouchResult.id,
              Category__c: category.category,
              Quantity__c: category.quantity
            };
            console.log('Creating pouch item:', itemRecord);
            return itemRecord;
          });

          try {
            console.log(`Attempting to create ${pouchItemRecords.length} pouch items`);
            const itemResults = await conn.sobject('Pouch_Items__c').create(pouchItemRecords);
            
            if (Array.isArray(itemResults)) {
              itemResults.forEach((result, i) => {
                if (result.success) {
                  console.log(`Pouch item ${i + 1} created successfully:`, result);
                } else {
                  console.error(`Pouch item ${i + 1} creation failed:`, result.errors);
                }
              });
            } else {
              if (itemResults.success) {
                console.log('Single pouch item created successfully:', itemResults);
              } else {
                console.error('Single pouch item creation failed:', itemResults.errors);
              }
            }
            
            return itemResults;
          } catch (error) {
            console.error('Error in pouch items creation:', error.message);
            console.error('Full error:', error);
            throw error;
          }
        } else {
          console.log(`No categories found for pouch ${index + 1}`);
        }
      });

      console.log('Waiting for all pouch items to be created...');
      const pouchItemResults = await Promise.all(pouchItemPromises);
      console.log('All pouch items creation completed:', pouchItemResults);
    }

    res.json({
      success: true,
      message: "Polishing record created successfully",
      data: {
        polishingId,
        polishingRecordId: polishingResult.id,
        pouches: pouchResults
      }
    });

  } catch (error) {
    console.error("Error creating polishing record:", error);
    console.error("Full error details:", JSON.stringify(error, null, 2));
    res.status(500).json({
      success: false,
      message: error.message || "Failed to create polishing record"
    });
  }
});

/**----------------- Create Plating Record ----------------- */
// app.post("/api/plating/create", async (req, res) => {
//   try {
//     const { 
//       platingId,  // This will be the formatted ID from frontend (e.g., 'PLAT/19/04/2025/01')
//       issuedDate,
//       pouches,
//       totalWeight,
//       status,
//       product,
//       quantity,
//       orderId
//     } = req.body;

//     // Create the Plating record with the provided platingId as Name
//     const platingResult = await conn.sobject('Plating__c').create({
//       Name: platingId,  // Using the platingId directly as Name
//       Issued_Date__c: issuedDate,
//       Issued_Weight__c: totalWeight,
//       Status__c: status,
//       Product__c : product,
//       Quantity__c: quantity,
//       Order_Id__c :orderId
//     });

//     console.log('[Plating Create] Plating record created:', platingResult);

//     if (!platingResult.success) {
//       throw new Error('Failed to create plating record');
//     }

//     // Update existing pouches
//     const pouchResults = await Promise.all(pouches.map(async pouch => {
//       console.log('[Plating Create] Updating pouch:', {
//         pouchId: pouch.pouchId,
//         weight: pouch.platingWeight,
//         platingId: platingId  // Log the formatted ID
//       });

//       const pouchResult = await conn.sobject('Pouch__c').update({
//         Id: pouch.pouchId,
//         Plating__c: platingId,        // Salesforce ID for relationship        // Store the formatted plating ID (e.g., PLAT/19/04/2025/01)
//         Issued_Weight_Plating__c: pouch.platingWeight,
//         Product__c : pouch.product,
//         Quantity__c : pouch.quantity
//       });

//       console.log('[Plating Create] Pouch updated:', pouchResult);
//       return pouchResult;
//     }));

//     res.json({
//       success: true,
//       message: "Plating record created successfully",
//       data: {
//         platingId: platingId,
//         platingRecordId: platingResult.id,
//         pouches: pouchResults
//       }
//     });

//   } catch (error) {
//     console.error("[Plating Create] Error:", error);
//     console.error("[Plating Create] Full error details:", JSON.stringify(error, null, 2));
//     res.status(500).json({
//       success: false,
//       message: error.message || "Failed to create plating record"
//     });
//   }
// });

/**----------------- Create Cutting Record ----------------- */
app.post("/api/cutting/create", async (req, res) => {
  try {
    const { 
      cuttingId,
      issuedDate,
      pouches,
      totalWeight,
      status,
      product,
      quantity,
      orderId
    } = req.body;

    console.log('[Cutting Create] Received data:', { 
      cuttingId,
      issuedDate,
      pouchCount: pouches.length,
      totalWeight,
      status
    });

    // Create the Cutting record
    const cuttingResult = await conn.sobject('Cutting__c').create({
      Name: cuttingId,
      Issued_Date__c: issuedDate,
      Issued_Weight__c: totalWeight,
      Status__c: status,
      Product__c: product,
      Quantity__c : quantity,
      Order_Id__c : orderId
    });

    console.log('[Cutting Create] Cutting record created:', cuttingResult);

    if (!cuttingResult.success) {
      throw new Error('Failed to create cutting record');
    }

    // Update existing pouches
    const pouchResults = await Promise.all(pouches.map(async pouch => {
      console.log('[Cutting Create] Updating pouch:', {
        pouchId: pouch.pouchId,
        weight: pouch.cuttingWeight
      });

      const pouchResult = await conn.sobject('Pouch__c').update({
        Id: pouch.pouchId,
        Cutting__c: cuttingId,          // Store the formatted cutting ID
        Issued_Weight_Cutting__c: pouch.cuttingWeight,
        Product__c : pouch.product,
        Quantity__c : pouch.quantity
      });

      
      console.log('[Cutting Create] Pouch updated:', pouchResult);
      return pouchResult;
    }));

    res.json({
      success: true,
      message: "Cutting record created successfully",
      data: {
        cuttingId: cuttingId,
        cuttingRecordId: cuttingResult.id,
        pouches: pouchResults
      }
    });

  } catch (error) {
    console.error("[Cutting Create] Error:", error);
    console.error("[Cutting Create] Full error details:", JSON.stringify(error, null, 2));
    res.status(500).json({
      success: false,
      message: error.message || "Failed to create cutting record"
    });
  }
});

/**----------------- Update Plating Received Weight ----------------- */
// app.post("/api/plating/update/:prefix/:date/:month/:year/:number/:subnumber", async (req, res) => {
//   try {
//     const { prefix, date, month, year, number, subnumber } = req.params;
//     const { receivedDate, receivedWeight, platingLoss, scrapReceivedWeight, dustReceivedWeight, ornamentWeight, pouches } = req.body;
//     const platingNumber = `${prefix}/${date}/${month}/${year}/${number}/${subnumber}`;

//     console.log('[Plating Update] Received data:', { 
//       platingNumber, 
//       receivedDate, 
//       receivedWeight, 
//       platingLoss,
//       scrapReceivedWeight,
//       dustReceivedWeight,
//       ornamentWeight,
//       pouches 
//     });

//     // First get the Plating record
//     const platingQuery = await conn.query(
//       `SELECT Id, Name FROM Plating__c WHERE Name = '${platingNumber}'`
//     );

//     if (!platingQuery.records || platingQuery.records.length === 0) {
//       return res.status(404).json({
//         success: false,
//         message: "Plating record not found"
//       });
//     }

//     const plating = platingQuery.records[0];

//     // Update the plating record
//     const updateData = {
//       Id: plating.Id,
//       Received_Date__c: receivedDate,
//       Returned_Weight__c: receivedWeight,
//       Plating_Loss__c: platingLoss,
//       Plating_Scrap_Weight__c: scrapReceivedWeight,
//       Plating_Dust_Weight__c: dustReceivedWeight,
//       Plating_Ornament_Weight__c: ornamentWeight,
//       Status__c: 'Finished'
//     };

//     const updateResult = await conn.sobject('Plating__c').update(updateData);

//     if (!updateResult.success) {
//       throw new Error('Failed to update plating record');
//     }

//     // Update pouches if provided
//     if (pouches && pouches.length > 0) {
//       for (const pouch of pouches) {
//         try {
//           const pouchUpdateResult = await conn.sobject('Pouch__c').update({
//             Id: pouch.pouchId,
//             Received_Weight_Plating__c: pouch.receivedWeight,
//             Plating_Loss__c: platingLoss
//           });

//           console.log(`[Plating Update] Pouch update result for ${pouch.pouchId}:`, pouchUpdateResult);
//         } catch (pouchError) {
//           console.error(`[Plating Update] Failed to update pouch ${pouch.pouchId}:`, pouchError);
//           throw pouchError;
//         }
//       }
//     }

//     // Check if scrap inventory exists for this purity
//     const scrapInventoryQuery = await conn.query(
//       `SELECT Id, Available_weight__c FROM Inventory_ledger__c 
//        WHERE Item_Name__c = 'Scrap' 
//        AND Purity__c = '${plating.Purity__c || '91.7%'}'`
//     );

//     if (scrapReceivedWeight > 0) {
//       if (scrapInventoryQuery.records.length > 0) {
//         // Update existing scrap inventory
//         const currentWeight = scrapInventoryQuery.records[0].Available_weight__c || 0;
//         const scrapUpdateResult = await conn.sobject('Inventory_ledger__c').update({
//           Id: scrapInventoryQuery.records[0].Id,
//           Available_weight__c: currentWeight + scrapReceivedWeight,
//           Last_Updated__c: receivedDate
//         });

//         if (!scrapUpdateResult.success) {
//           throw new Error('Failed to update scrap inventory');
//         }
//       } else {
//         // Create new scrap inventory
//         const scrapCreateResult = await conn.sobject('Inventory_ledger__c').create({
//           Name: 'Scrap',
//           Item_Name__c: 'Scrap',
//           Purity__c: plating.Purity__c || '91.7%',
//           Available_weight__c: scrapReceivedWeight,
//           Unit_of_Measure__c: 'Grams',
//           Last_Updated__c: receivedDate
//         });

//         if (!scrapCreateResult.success) {
//           throw new Error('Failed to create scrap inventory');
//         }
//       }
//     }

//     // Check if dust inventory exists
//     const dustInventoryQuery = await conn.query(
//       `SELECT Id, Available_weight__c FROM Inventory_ledger__c 
//        WHERE Item_Name__c = 'Dust' 
//        AND Purity__c = '${plating.Purity__c || '91.7%'}'`
//     );

//     if (dustReceivedWeight > 0) {
//       if (dustInventoryQuery.records.length > 0) {
//         // Update existing dust inventory
//         const currentWeight = dustInventoryQuery.records[0].Available_weight__c || 0;
//         const dustUpdateResult = await conn.sobject('Inventory_ledger__c').update({
//           Id: dustInventoryQuery.records[0].Id,
//           Available_weight__c: currentWeight + dustReceivedWeight,
//           Last_Updated__c: receivedDate
//         });

//         if (!dustUpdateResult.success) {
//           throw new Error('Failed to update dust inventory');
//         }
//       } else {
//         // Create new dust inventory
//         const dustCreateResult = await conn.sobject('Inventory_ledger__c').create({
//           Name: 'Dust',
//           Item_Name__c: 'Dust',
//           Purity__c: plating.Purity__c || '91.7%',
//           Available_weight__c: dustReceivedWeight,
//           Unit_of_Measure__c: 'Grams',
//           Last_Updated__c: receivedDate
//         });

//         if (!dustCreateResult.success) {
//           throw new Error('Failed to create dust inventory');
//         }
//       }
//     }

//     res.json({
//       success: true,
//       message: "Plating record updated successfully",
//       data: {
//         platingNumber,
//         receivedDate,
//         receivedWeight,
//         platingLoss,
//         scrapReceivedWeight,
//         dustReceivedWeight,
//         ornamentWeight,
//         status: 'Finished'
//       }
//     });

//   } catch (error) {
//     console.error("[Plating Update] Error:", error);
//     console.error("[Plating Update] Full error details:", JSON.stringify(error, null, 2));
//     res.status(500).json({
//       success: false,
//       message: error.message || "Failed to update plating record"
//     });
//   }
// });

/**----------------- Update Cutting Received Weight ----------------- */

// =================================   get process summary  ==========================================================

// app.get("/api/process-summary", checkSalesforceConnection , async (req, res) => {
//   try {
//     const pool = req.mssql;
//     const result = await pool.request().query(
//       `-- Combined Process Summary (Standardized)
// SELECT 'Casting' AS process,
//     ISNULL(SUM(TRY_CAST(Issud_weight_c AS FLOAT)), 0) AS issued_wt,
//     ISNULL(SUM(TRY_CAST(Weight_Received_c AS FLOAT)), 0) AS received_wt,
//     ISNULL(SUM(TRY_CAST(Casting_Loss_c AS FLOAT)), 0) AS loss_wt,
//     ISNULL(SUM(TRY_CAST(Casting_Scrap_Weight_c AS FLOAT)), 0) AS scrap_wt,
//     ISNULL(SUM(TRY_CAST(Casting_Dust_Weight_c AS FLOAT)), 0) AS dust_wt
// FROM Casting_dept__c

// UNION ALL

// SELECT 'Filing' AS process,
//     ISNULL(SUM(TRY_CAST(Issued_weight_c AS FLOAT)), 0) AS issued_wt,
//     ISNULL(SUM(TRY_CAST(Receievd_weight_c AS FLOAT)), 0) AS received_wt,
//     ISNULL(SUM(TRY_CAST(Filing_loss_c AS FLOAT)), 0) AS loss_wt,
//     ISNULL(SUM(TRY_CAST(Filing_Scrap_Weight_c AS FLOAT)), 0) AS scrap_wt,
//     ISNULL(SUM(TRY_CAST(Filing_Dust_Weight_c AS FLOAT)), 0) AS dust_wt
// FROM Filing__c

// UNION ALL

// SELECT 'Grinding' AS process,
//     ISNULL(SUM(TRY_CAST(Issued_Weight_c AS FLOAT)), 0) AS issued_wt,
//     ISNULL(SUM(TRY_CAST(Received_Weight_c AS FLOAT)), 0) AS received_wt,
//     ISNULL(SUM(TRY_CAST(Grinding_loss_c AS FLOAT)), 0) AS loss_wt,
//     ISNULL(SUM(TRY_CAST(Grinding_Scrap_Weight_c AS FLOAT)), 0) AS scrap_wt,
//     ISNULL(SUM(TRY_CAST(Grinding_Dust_Weight_c AS FLOAT)), 0) AS dust_wt
// FROM Grinding__c

// UNION ALL

// SELECT 'Setting' AS process,
//     ISNULL(SUM(TRY_CAST(Issued_Weight_c AS FLOAT)), 0) AS issued_wt,
//     ISNULL(SUM(TRY_CAST(Returned_weight_c AS FLOAT)), 0) AS received_wt,
//     ISNULL(SUM(TRY_CAST(Setting_l_c AS FLOAT)), 0) AS loss_wt,
//     ISNULL(SUM(TRY_CAST(Setting_Scrap_Weight_c AS FLOAT)), 0) AS scrap_wt,
//     ISNULL(SUM(TRY_CAST(Setting_Dust_Weight_c AS FLOAT)), 0) AS dust_wt
// FROM Setting__c

// UNION ALL

// SELECT 'Polishing' AS process,
//     ISNULL(SUM(TRY_CAST(Issued_Weight_c AS FLOAT)), 0) AS issued_wt,
//     ISNULL(SUM(TRY_CAST(Received_Weight_c AS FLOAT)), 0) AS received_wt,
//     ISNULL(SUM(TRY_CAST(Polishing_Scrap_Weight_c AS FLOAT)), 0) AS loss_wt,
//     ISNULL(SUM(TRY_CAST(Polishing_Scrap_Weight_c AS FLOAT)), 0) AS scrap_wt,
//     ISNULL(SUM(TRY_CAST(Polishing_Dust_Weight_c AS FLOAT)), 0) AS dust_wt
// FROM Polishing__c

// UNION ALL

// SELECT 'Dull' AS process,
//     ISNULL(SUM(TRY_CAST(Issued_Weight_c AS FLOAT)), 0) AS issued_wt,
//     ISNULL(SUM(TRY_CAST(Returned_weight_c AS FLOAT)), 0) AS received_wt,
//     ISNULL(SUM(TRY_CAST(Dull_Loss_c AS FLOAT)), 0) AS loss_wt,
//     0 AS scrap_wt,
//     ISNULL(SUM(TRY_CAST(Dull_Loss_c AS FLOAT)), 0) AS dust_wt
// FROM Dull__c

// UNION ALL

// SELECT 'Plating' AS process,
//     ISNULL(SUM(TRY_CAST(Issued_Weight_c AS FLOAT)), 0) AS issued_wt,
//     ISNULL(SUM(TRY_CAST(Returned_weight_c AS FLOAT)), 0) AS received_wt,
//     ISNULL(SUM(TRY_CAST(Plating_loss_c AS FLOAT)), 0) AS loss_wt,
//     ISNULL(SUM(TRY_CAST(Plating_Scrap_Weight_c AS FLOAT)), 0) AS scrap_wt,
//     ISNULL(SUM(TRY_CAST(Plating_Dust_Weight_c AS FLOAT)), 0) AS dust_wt
// FROM Plating__c

// UNION ALL

// SELECT 'Cutting' AS process,
//     ISNULL(SUM(TRY_CAST(Issued_Weight_c AS FLOAT)), 0) AS issued_wt,
//     ISNULL(SUM(TRY_CAST(Returned_weight_c AS FLOAT)), 0) AS received_wt,
//     ISNULL(SUM(TRY_CAST(Cutting_loss_c AS FLOAT)), 0) AS loss_wt,
//     ISNULL(SUM(TRY_CAST(Cutting_Scrap_Weight_c AS FLOAT)), 0) AS scrap_wt,
//     ISNULL(SUM(TRY_CAST(Cutting_Dust_Weight_c AS FLOAT)), 0) AS dust_wt
// FROM Cutting__c;

// `); // Replace with your query

//     res.json({
//       success: true,
//       data: result.recordset
//     });
//   } catch (err) {
//     console.error("SQL error", err);
//     res.status(500).json({ success: false, message: "SQL error", error: err });
//   }
// });


app.post("/api/cutting/update/:prefix/:date/:month/:year/:number/:subnumber",checkMssqlConnection, async (req, res) => {
  try {
    const { prefix, date, month, year, number, subnumber } = req.params;
    const { receivedDate, receivedWeight, cuttingLoss, scrapReceivedWeight, dustReceivedWeight, ornamentWeight, pouches } = req.body;
    const cuttingNumber = `${prefix}/${date}/${month}/${year}/${number}/${subnumber}`;

    
    const pool = req.mssql;

    console.log('[Cutting Update] Received data:', { 
      cuttingNumber, 
      receivedDate, 
      receivedWeight, 
      cuttingLoss,
      scrapReceivedWeight,
      dustReceivedWeight,
      ornamentWeight,
      pouches 
    });

    // First get the Cutting record
    const cuttingQuery = await pool.request().query(
      `SELECT Id, Name FROM Cutting__c WHERE Name = '${cuttingNumber}'`
    );

    if (!cuttingQuery.records || cuttingQuery.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Cutting record not found"
      });
    }

    const cutting = cuttingQuery.recordset[0];

    // Update the cutting record
    const updateData = {
      Id: cutting.Id,
      Received_Date__c: receivedDate,
      Returned_Weight__c: receivedWeight,
      Cutting_Loss__c: cuttingLoss,
      Cutting_Scrap_Weight__c: scrapReceivedWeight,
      Cutting_Dust_Weight__c: dustReceivedWeight,
      Cutting_Ornament_Weight__c: ornamentWeight,
      Status__c: 'Finished'
    };

    const updateResult = await conn.sobject('Cutting__c').update(updateData);

    if (!updateResult.success) {
      throw new Error('Failed to update cutting record');
    }

    // Update pouches if provided
    if (pouches && pouches.length > 0) {
      for (const pouch of pouches) {
        try {
          const pouchUpdateResult = await conn.sobject('Pouch__c').update({
            Id: pouch.pouchId,
            Received_Weight_Cutting__c: pouch.receivedWeight,
            Cutting_Loss__c: cuttingLoss
          });

          console.log(`[Cutting Update] Pouch update result for ${pouch.pouchId}:`, pouchUpdateResult);
        } catch (pouchError) {
          console.error(`[Cutting Update] Failed to update pouch ${pouch.pouchId}:`, pouchError);
          throw pouchError;
        }
      }
    }

    // Check if scrap inventory exists for this purity
    const scrapInventoryQuery = await pool.request().query(
      `SELECT Id, Available_weight__c FROM Inventory_ledger__c 
       WHERE Item_Name__c = 'Scrap' 
       AND Purity__c = '${cutting.Purity__c || '91.7%'}'`
    );

    if (scrapReceivedWeight > 0) {
      if (scrapInventoryQuery.records.length > 0) {
        // Update existing scrap inventory
        const currentWeight = scrapInventoryQuery.records[0].Available_weight__c || 0;
        const scrapUpdateResult = await pool.request().sobject('Inventory_ledger__c').update({
          Id: scrapInventoryQuery.records[0].Id,
          Available_weight__c: currentWeight + scrapReceivedWeight,
          Last_Updated__c: receivedDate
        });

        if (!scrapUpdateResult.success) {
          throw new Error('Failed to update scrap inventory');
        }
      } else {
        // Create new scrap inventory
        const scrapCreateResult = await pool.request().sobject('Inventory_ledger__c').create({
          Name: 'Scrap',
          Item_Name__c: 'Scrap',
          Purity__c: cutting.Purity__c || '91.7%',
          Available_weight__c: scrapReceivedWeight,
          Unit_of_Measure__c: 'Grams',
          Last_Updated__c: receivedDate
        });

        if (!scrapCreateResult.success) {
          throw new Error('Failed to create scrap inventory');
        }
      }
    }

    // Check if dust inventory exists
    const dustInventoryQuery = await pool.request().query(
      `SELECT Id, Available_weight__c FROM Inventory_ledger__c 
       WHERE Item_Name__c = 'Dust' 
       AND Purity__c = '${cutting.Purity__c || '91.7%'}'`
    );

    if (dustReceivedWeight > 0) {
      if (dustInventoryQuery.recordset.length > 0) {
        // Update existing dust inventory
        const currentWeight = dustInventoryQuery.recordset[0].Available_weight__c || 0;
        const dustUpdateResult = await conn.sobject('Inventory_ledger__c').update({
          Id: dustInventoryQuery.recordset[0].Id,
          Available_weight__c: currentWeight + dustReceivedWeight,
          Last_Updated__c: receivedDate
        });

        if (!dustUpdateResult.success) {
          throw new Error('Failed to update dust inventory');
        }
      } else {
        // Create new dust inventory
        const dustCreateResult = await pool.request().sobject('Inventory_ledger__c').create({
          Name: 'Dust',
          Item_Name__c: 'Dust',
          Purity__c: cutting.Purity__c || '91.7%',
          Available_weight__c: dustReceivedWeight,
          Unit_of_Measure__c: 'Grams',
          Last_Updated__c: receivedDate
        });

        if (!dustCreateResult.success) {
          throw new Error('Failed to create dust inventory');
        }
      }
    }

    res.json({
      success: true,
      message: "Cutting record updated successfully",
      data: {
        cuttingNumber,
        receivedDate,
        receivedWeight,
        cuttingLoss,
        scrapReceivedWeight,
        dustReceivedWeight,
        ornamentWeight,
        status: 'Finished'
      }
    });

  } catch (error) {
    console.error("[Cutting Update] Error:", error);
    console.error("[Cutting Update] Full error details:", JSON.stringify(error, null, 2));
    res.status(500).json({
      success: false,
      message: error.message || "Failed to update cutting record"
    });
  }
});
/**----------------- Get All Plating Records -----------------  connection changed  / table created  */
// app.get("/api/plating",checkMssqlConnection, async (req, res) => {
//   try {
//     console.log('[Get Plating] Fetching all plating records');
//  const pool = req.mssql;
//     const platingQuery = await pool.request().query(
//       `SELECT 
//         Id,
//         Name,
//         Issued_Date_c,
//         Issued_Weight_c,
//         Returned_weight_c,
//         Received_Date_c,
//         Status_c,
//         Product_c,
//         Order_Id_c,
//         Quantity_c,
//         Plating_loss_c,
//         CreatedDate,Plating_Scrap_Weight_c,Plating_Dust_Weight_c
//        FROM Plating__c
//        ORDER BY CreatedDate DESC`
//     );

//     console.log('[Get Plating] Found plating records:', platingQuery.recordset.length);

//     res.json({
//       success: true,
//       data: platingQuery.recordset
//     });

//   } catch (error) {
//     console.error("[Get Plating] Error:", error);
//     console.error("[Get Plating] Full error details:", JSON.stringify(error, null, 2));
//     res.status(500).json({
//       success: false,
//       message: error.message || "Failed to fetch plating records"
//     });
//   }
// });

/**----------------- Get All Cutting Records -----------------  connection Changed  / Table created */
app.get("/api/cutting",checkMssqlConnection, async (req, res) => {

  
    const pool = req.mssql;

  try {
    console.log('[Get Cutting] Fetching all cutting records');

    const cuttingQuery = await pool.request().query(
      `SELECT 
        Id,
        Name,
        Issued_Date_c,
        Issued_Weight_c,
        Returned_weight_c,
        Received_Date_c,
        Status_c,
        Product_c,
        Quantity_c,
        Order_Id_c,
        Cutting_loss_c,
        CreatedDate,Cutting_Scrap_Weight_c ,Cutting_Ornament_Weight_c
       FROM Cutting__c
       ORDER BY CreatedDate DESC`
    );

    console.log('[Get Cutting] Found cutting records:', cuttingQuery.recordset.length);

    res.json({
      success: true,
      data: cuttingQuery.recordset
    });

  } catch (error) {
    console.error("[Get Cutting] Error:", error);
    console.error("[Get Cutting] Full error details:", JSON.stringify(error, null, 2));
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch cutting records"
    });
  }
});

/**----------------- Get Plating Details -----------------  connection changed   / table created  */
app.get("/api/plating-details/:prefix/:date/:month/:year/:number",checkMssqlConnection, async (req, res) => {
  try {
    const { prefix, date, month, year, number } = req.params;
    const platingId = `${prefix}/${date}/${month}/${year}/${number}`;

    const pool = req.mssql;
    // 1. Get Plating details
    const platingQuery = await pool.request().query(
      `SELECT 
        Id,
        Name,
        Issued_Date_c,
        Issued_Weight_c,
        Returned_weight_c,
        Received_Date_c,
        Status_c,
        Plating_loss_c
       FROM Plating__c
       WHERE Name = '${platingId}'`
    );

    if (!platingQuery.recordset || platingQuery.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Plating record not found"
      });
    }

    const plating = platingQuery.recordset[0];

    // 2. Get Pouches for this plating
    const pouchesQuery = await pool.request().query(
      `SELECT 
        Id,
        Name,
        Order_Id_c,
        Issued_Weight_Plating_c,
        Received_Weight_Plating_c
       FROM Pouch__c 
       WHERE Plating__c = '${platingId}'`
    );

    // 3. Get Orders for these pouches
    const orderIds = pouchesQuery.recordset.map(pouch => `'${pouch.Order_Id__c}'`).join(',');
    let orders = [];
    let models = [];

    if (orderIds.length > 0) {
      const ordersQuery = await pool.request().query(
        `SELECT 
          Id,
          Name,
          Order_Id_c,
          Party_Name_c,
          Delivery_Date_c,
          Status_c
         FROM Order__c 
         WHERE Order_Id_c IN (${orderIds})`
      );
      
      orders = ordersQuery.recordset;

      // 4. Get Models for these orders
      const orderIdsForModels = orders.map(order => `'${order.Id}'`).join(',');
      if (orderIdsForModels.length > 0) {
        const modelsQuery = await pool.request().query(
          `SELECT 
            Id,
            Name,
            Order_c,
            Category_c,
            Purity_c,
            Size_c,
            Color_c,
            Quantity_c,
            Gross_Weight_c,
            Stone_Weight_c,
            Net_Weight_c
           FROM Order_Models__c 
           WHERE Order_c IN (${orderIdsForModels})`
        );
        
        models = modelsQuery.recordset;
      }
    }

    const response = {
      success: true,
      data: {
        plating: plating,
        pouches: pouchesQuery.recordset.map(pouch => {
          const relatedOrder = orders.find(order => order.Order_Id__c === pouch.Order_Id__c);
          const pouchModels = relatedOrder ? models.filter(model => 
            model.Order__c === relatedOrder.Id
          ) : [];

          return {
            ...pouch,
            order: relatedOrder || null,
            models: pouchModels
          };
        })
      },
      summary: {
        totalPouches: pouchesQuery.recordset.length,
        totalOrders: orders.length,
        totalModels: models.length,
        totalPouchWeight: pouchesQuery.recordset.reduce((sum, pouch) => 
              sum + (pouch.Issued_Weight_Plating__c || 0), 0),
        issuedWeight: plating.Issued_Weight__c,
        receivedWeight: plating.Returned_weight__c,
        platingLoss: plating.Plating_loss__c
      }
    };

    res.json(response);

  } catch (error) {
    console.error("Error fetching plating details:", error);
    console.error("Full error details:", JSON.stringify(error, null, 2));
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch plating details"
    });
  }
});

/**----------------- Get Cutting Details -----------------  connection changed  / table created  */
app.get("/api/cutting-details/:prefix/:date/:month/:year/:number",checkMssqlConnection, async (req, res) => {
  try {
    const { prefix, date, month, year, number } = req.params;
    const cuttingId = `${prefix}/${date}/${month}/${year}/${number}`;

    const pool = req.mssql;
    // 1. Get Cutting details
    const cuttingQuery = await pool.request().query(
      `SELECT 
        Id,
        Name,
        Issued_Date_c,
        Issued_Weight_c,
        Returned_weight_c,
        Received_Date_c,
        Status_c,
        Cutting_loss_c
       FROM Cutting__c
       WHERE Name = '${cuttingId}'`
    );

    if (!cuttingQuery.records || cuttingQuery.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Cutting record not found"
      });
    }

    const cutting = cuttingQuery.recordset[0];

    // 2. Get Pouches for this cutting
    const pouchesQuery = await pool.request().query(
      `SELECT 
        Id,
        Name,
        Order_Id_c,
        Issued_Weight_Cutting_c,
        Received_Weight_Cutting_c
       FROM Pouch_c 
       WHERE Cutting__c = '${cuttingId}'`
    );

    // 3. Get Orders for these pouches
    const orderIds = pouchesQuery.recordset.map(pouch => `'${pouch.Order_Id__c}'`).join(',');
    let orders = [];
    let models = [];

    if (orderIds.length > 0) {
      const ordersQuery = await pool.request().query(
        `SELECT 
          Id,
          Name,
          Order_Id_c,
          Party_Name_c,
          Delivery_Date_c,
          Status_c
         FROM Order__c 
         WHERE Order_Id_c IN (${orderIds})`
      );
      
      orders = ordersQuery.recordset;

      // 4. Get Models for these orders
      const orderIdsForModels = orders.map(order => `'${order.Id}'`).join(',');
      if (orderIdsForModels.length > 0) {
        const modelsQuery = await conn.query(
          `SELECT 
            Id,
            Name,
            Order_c,
            Category_c,
            Purity_c,
            Size_c,
            Color_c,
            Quantity_c,
            Gross_Weight_c,
            Stone_Weight_c,
            Net_Weight_c
           FROM Order_Models__c 
           WHERE Order_c IN (${orderIdsForModels})`
        );
        
        models = modelsQuery.recordset;
      }
    }

    const response = {
      success: true,
      data: {
        cutting: cutting,
        pouches: pouchesQuery.recordset.map(pouch => {
          const relatedOrder = orders.find(order => order.Order_Id__c === pouch.Order_Id__c);
          const pouchModels = relatedOrder ? models.filter(model => 
            model.Order__c === relatedOrder.Id
          ) : [];

          return {
            ...pouch,
            order: relatedOrder || null,
            models: pouchModels
          };
        })
      },
      summary: {
        totalPouches: pouchesQuery.recordset.length,
        totalOrders: orders.length,
        totalModels: models.length,
        totalPouchWeight: pouchesQuery.recordset.reduce((sum, pouch) => 
              sum + (pouch.Issued_Weight_Cutting__c || 0), 0),
        issuedWeight: cutting.Issued_Weight__c,
        receivedWeight: cutting.Returned_weight__c,
        cuttingLoss: cutting.Cutting_loss__c
      }
    };

    res.json(response);

  } catch (error) {
    console.error("Error fetching cutting details:", error);
    console.error("Full error details:", JSON.stringify(error, null, 2));
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch cutting details"
    });
  }
});

/**----------------- Get Pouches for Plating ----------------- connection Changed   / table created  */

// app.get("/api/plating/:prefix/:date/:month/:year/:number/:subnumber/pouches",checkMssqlConnection, async (req, res) => {
//   try {
//     const { prefix, date, month, year, number,subnumber } = req.params;
//     const platingId = `${prefix}/${date}/${month}/${year}/${number}/${subnumber}`;
    
//     console.log('[Get Plating Pouches] Fetching details for plating:', platingId);

//     const pool = req.mssql;

//     // First get the Plating record with all fields
//     const platingQuery = await pool.request().query(
//       `SELECT 
//         Id,
//         Name,
//         Issued_Date_c,
//         Issued_Weight_c,
//         Returned_weight_c,
//         Received_Date_c,
//         Status_c,
//         Plating_loss_c
//        FROM Plating__c 
//        WHERE Name = '${platingId}'`
//     );

//     if (!platingQuery.recordset || platingQuery.recordset.length === 0) {
//       console.log('[Get Plating Pouches] Plating not found:', platingId);
//       return res.status(404).json({
//         success: false,
//         message: "Plating record not found"
//       });
//     }

//     // Get pouches with their IDs and weights
//     const pouchesQuery = await pool.request().query(
//       `SELECT 
//         Id, 
//         Name,
//         Issued_Weight_Plating_c,
//         Received_Weight_Plating_c,
//         Quantity_c,
//         Product_c,
//         Order_Id_c
//        FROM Pouch__c 
//        WHERE Plating__c = '${platingId}'`
//     );

//     console.log('[Get Plating Pouches] Found pouches:', pouchesQuery.recordset);
//     console.log('[Get Plating Pouches] Plating details:', platingQuery.recordset[0]);

//     res.json({
//       success: true,
//       data: {
//         plating: platingQuery.recordsets[0],
//         pouches: pouchesQuery.recordset
//       }
//     });

//   } catch (error) {
//     console.error("[Get Plating Pouches] Error:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to fetch plating details"
//     });
//   }
// });

/**----------------- Get Pouches for Cutting ----------------- connection Changed / Table created   */  






app.get("/api/cutting/:prefix/:date/:month/:year/:number/:subnumber/pouches",checkSalesforceConnection, async (req, res) => {
  try {
    const { prefix, date, month, year, number, subnumber } = req.params;
    const cuttingId = `${prefix}/${date}/${month}/${year}/${number}/${subnumber}`;
    

    const pool = req.mssql;


    console.log('[Get Cutting Pouches] Fetching details for cutting:', cuttingId);

    // First get the Cutting record with all fields
    const cuttingQuery = await pool.request().query(
      `SELECT 
        Id,
        Name,
        Issued_Date_c,
        Issued_Weight_c,
        Returned_weight_c,
        Received_Date_c,
        Status_c,
        Cutting_loss_c
       FROM Cutting__c 
       WHERE Name = '${cuttingId}'`
    );

    if (!cuttingQuery.recordset || cuttingQuery.recordset.length === 0) {
      console.log('[Get Cutting Pouches] Cutting not found:', cuttingId);
      return res.status(404).json({
        success: false,
        message: "Cutting record not found"
      });
    }

    // Get pouches with their IDs and weights
    const pouchesQuery = await pool.request().query(
      `SELECT 
        Id, 
        Name,
        Issued_Weight_Cutting_c,
        Received_Weight_Cutting_c
       FROM Pouch__c 
       WHERE Cutting__c = '${cuttingId}'`
    );

    console.log('[Get Cutting Pouches] Found pouches:', pouchesQuery.recordset);
    console.log('[Get Cutting Pouches] Cutting details:', cuttingQuery.recordset[0]);

    res.json({
      success: true,
      data: {
        cutting: cuttingQuery.recordset[0],
        pouches: pouchesQuery.recordset
      }
    });

  } catch (error) {
    console.error("[Get Cutting Pouches] Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch cutting details"
    });
  }
});




// ======================  Api  transactions  Behinds Sales Force  ==================================================
// app.get("/get-inventory-transactions", async (req, res) => {
//   try {
//     // Query Salesforce for issued inventory records
//     const result = await conn.query(`
//       SELECT 
//         Id,
//         Name,
//         Issued_Date__c,
//         Purity__c,
//         Pure_Metal_weight__c,
//         Alloy_Weight__c,
//         CreatedDate,
//         CreatedBy.Name
//       FROM Issued_inventory__c
//       ORDER BY CreatedDate ASC
//     `);

//     if (!result.records || result.records.length === 0) {
//       return res.status(404).json({
//         success: false,
//         message: "Inventory Issued records not found"
//       });
//     }

//     // Map Salesforce data to desired JSON format
//     const inventoryItems = result.records.map(item => ({
//       id: item.Id,
//       name: item.Name,
//       purity: item.Purity__c,
//       issuedDate: item.Issued_Date__c,
//       pureMetalWeight: item.Pure_Metal_weight__c,
//       alloyWeight: item.Alloy_Weight__c,
//       createdDate: item.CreatedDate,
//       createdByName: item.CreatedBy?.Name || null
//     }));

//     res.status(200).json({
//       success: true,
//       message: "Inventory Transaction items fetched successfully",
//       data: inventoryItems
//     });

//   } catch (error) {
//     console.error("Error fetching inventory:", error);
//     res.status(500).json({
//       success: false,
//       message: error.message || "Failed to fetch inventory items"
//     });
//   }
// });


// ======================  process rpeort overall with date filter ==================================================

// app.get("/api/process-summary", async (req, res) => {
//   try {
//     const { fromDate, toDate } = req.query;

//     // Convert to Salesforce DateTime format
//     const fromDateTime = `${fromDate}T00:00:00Z`;
//     const toDateTime = `${toDate}T23:59:59Z`;

//     const processes = [
//       { name: "Casting", object: "Casting_dept__c", dateField: "Issued_Date__c", fields: { issued: "Issud_weight__c", received: "Weight_Received__c", loss: "Casting_Loss__c", scrap: "Casting_Scrap_Weight__c", dust: "Casting_Dust_Weight__c" }},
//       { name: "Pouch Creation", object: "Filing__c", dateField: "Issued_Date__c", fields: { issued: "Issued_weight__c", received: "Receievd_weight__c", loss: "Filing_loss__c", scrap: "Filing_Scrap_Weight__c", dust: "Filing_Dust_Weight__c" }},
//       { name: "Grinding", object: "Grinding__c", dateField: "Issued_Date__c", fields: { issued: "Issued_Weight__c", received: "Received_Weight__c", loss: "Grinding_loss__c", scrap: "Grinding_Scrap_Weight__c", dust: "Grinding_Dust_Weight__c" }},
//      { name: "Media", object: "Media__c", dateField: "Issued_Date__c", fields: { issued: "Issued_Weight__c", received: "Received_Weight__c", loss: "Grinding_loss__c", scrap: "Grinding_Scrap_Weight__c", dust: "Grinding_Dust_Weight__c" }},
//      { name: "Correction", object: "Correction_c__c", dateField: "Issued_Date__c", fields: { issued: "Issued_Weight__c", received: "Received_Weight__c", loss: "Grinding_loss__c", scrap: "Grinding_Scrap_Weight__c", dust: "Grinding_Dust_Weight__c" }},
//       { name: "Setting", object: "Setting__c", dateField: "Issued_Date__c", fields: { issued: "Issued_Weight__c", received: "Returned_weight__c", loss: "Setting_l__c", scrap: "Setting_Scrap_Weight__c", dust: "Setting_Dust_Weight__c" }},
//       { name: "Polishing", object: "Polishing__c", dateField: "Issued_Date__c", fields: { issued: "Issued_Weight__c", received: "Received_Weight__c", loss: "Polishing_Loss__c", scrap: "Polishing_Scrap_Weight__c", dust: "Polishing_Dust_Weight__c" }},
//       { name: "Dull", object: "Dull__c", dateField: "Issued_Date__c", fields: { issued: "Issued_Weight__c", received: "Returned_weight__c", loss: "Dull_loss__c", scrap: "Dull_Scrap_Weight__c", dust: "Dull_Dust_Weight__c" }},
//       { name: "Plating", object: "Plating__c", dateField: "Issued_Date__c", fields: { issued: "Issued_Weight__c", received: "Returned_Weight__c", loss: "Plating_loss__c", scrap: "Plating_Scrap_Weight__c", dust: "Plating_Dust_Weight__c" }},
//       { name: "Cutting", object: "Cutting__c", dateField: "Issued_Date__c", fields: { issued: "Issued_Weight__c", received: "Returned_Weight__c", loss: "Cutting_loss__c", scrap: "Cutting_Scrap_Weight__c", dust: "Cutting_Dust_Weight__c" }}
//     ];

//     let results = [];

//     for (let p of processes) {
//       const fieldList = Object.values(p.fields).filter(Boolean).join(", ");
      
//       // Add date filter in SOQL
//       const soql = `
//         SELECT ${fieldList}
//         FROM ${p.object}
//         WHERE ${p.dateField} >= ${fromDateTime}
//         AND ${p.dateField} <= ${toDateTime}
//       `;

//       const queryRes = await conn.query(soql);

//       let issued = 0, received = 0, loss = 0, scrap = 0, dust = 0,processWt=0;
    
//     queryRes.records.forEach(r => {
      
//       console.log(p.name +" - "+r[p.fields.received]);

//   const issuedVal = parseFloat(r[p.fields.issued] || 0);
//   const receivedVal = parseFloat(r[p.fields.received] || 0);

//   issued += issuedVal;

//   // ✅ Check the actual received value
//   if (receivedVal == 0) {
//     processWt += issuedVal;
//   }

//   received += receivedVal;
//   loss += parseFloat(r[p.fields.loss] || 0);
//   scrap += parseFloat(p.fields.scrap ? r[p.fields.scrap] || 0 : 0);
//   dust += parseFloat(r[p.fields.dust] || 0);
// });



// results.push({
//   process: p.name,
//   issued_wt: issued,
//   process_wt: processWt, // ✅ now has real value
//   received_wt: received,
//   loss_wt: loss,
//   scrap_wt: scrap,
//   dust_wt: dust
// });

//     }

//     res.json({ success: true, data: results });
//   } catch (err) {
//     console.error("Error fetching process summary:", err);
//     res.status(500).json({ success: false, message: "Error fetching process summary", error: err.message });
//   }
// });

// ======================================================================================================================


// app.get("/api/process-report", async (req, res) => {
//   try {
  
//     const processes = [
//       { name: "Casting", object: "Casting_dept__c",  fields: { issued: "Issud_weight__c", received: "Weight_Received__c", loss: "Casting_Loss__c", scrap: "Casting_Scrap_Weight__c", dust: "Casting_Dust_Weight__c" }},
//       { name: "Pouch Creation", object: "Filing__c",  fields: { issued: "Issued_weight__c", received: "Receievd_weight__c", loss: "Filing_loss__c", scrap: "Filing_Scrap_Weight__c", dust: "Filing_Dust_Weight__c" }},
//       { name: "Grinding", object: "Grinding__c",  fields: { issued: "Issued_Weight__c", received: "Received_Weight__c", loss: "Grinding_loss__c", scrap: "Grinding_Scrap_Weight__c", dust: "Grinding_Dust_Weight__c" }},
//        { name: "Media", object: "Media__c",  fields: { issued: "Issued_Weight__c", received: "Received_Weight__c", loss: "Grinding_loss__c", scrap: "Grinding_Scrap_Weight__c", dust: "Grinding_Dust_Weight__c" }},
//       { name: "Correction", object: "Correction_c__c",  fields: { issued: "Issued_Weight__c", received: "Received_Weight__c", loss: "Grinding_loss__c", scrap: "Grinding_Scrap_Weight__c", dust: "Grinding_Dust_Weight__c" }},
//        { name: "Setting", object: "Setting__c",  fields: { issued: "Issued_Weight__c", received: "Returned_weight__c", loss: "Setting_l__c", scrap: "Setting_Scrap_Weight__c", dust: "Setting_Dust_Weight__c" }},
//       { name: "Polishing", object: "Polishing__c",  fields: { issued: "Issued_Weight__c", received: "Received_Weight__c", loss: "Polishing_Loss__c", scrap: "Polishing_Scrap_Weight__c", dust: "Polishing_Dust_Weight__c" }},
//       { name: "Dull", object: "Dull__c",fields: { issued: "Issued_Weight__c", received: "Returned_weight__c", loss: "Dull_loss__c", scrap: "Dull_Scrap_Weight__c", dust: "Dull_Dust_Weight__c" }},
//       { name: "Plating", object: "Plating__c",  fields: { issued: "Issued_Weight__c", received: "Returned_Weight__c", loss: "Plating_loss__c", scrap: "Plating_Scrap_Weight__c", dust: "Plating_Dust_Weight__c" }},
//       { name: "Cutting", object: "Cutting__c", fields: { issued: "Issued_Weight__c", received: "Returned_Weight__c", loss: "Cutting_loss__c", scrap: "Cutting_Scrap_Weight__c", dust: "Cutting_Dust_Weight__c" }}
//     ];

//     console.log(processes);

//     let results = [];

//     for (let p of processes) {
//       const fieldList = Object.values(p.fields).filter(Boolean).join(", ");
      
//       // Add date filter in SOQL
//       const soql = `SELECT ${fieldList} FROM ${p.object}`;

//       const queryRes = await conn.query(soql);

//       let issued = 0, received = 0, loss = 0, scrap = 0, dust = 0,processWt=0;
    

// //     queryRes.records.forEach(r => {


// //       console.log(p.name+" - "+r[p.fields.received])

// //   const issuedVal = parseFloat(r[p.fields.issued] || 0);
// //   const receivedVal = parseFloat(r[p.fields.received] || 0);

// //   issued += issuedVal;

// //   // ✅ Check the actual received value
// //   if (receivedVal == 0) {
// //     processWt += issuedVal;
// //   }
// //   received += receivedVal;
// // });

// queryRes.records.forEach(r => {
  
//       // console.log(p.name+" - "+r[p.fields.received])

//   const issuedRaw = r[p.fields.issued];
// const receivedRaw = r[p.fields.received];

// const issuedVal = parseFloat(issuedRaw || 0);
// const receivedVal = receivedRaw ? parseFloat(receivedRaw) : 0;

// if (!receivedRaw || receivedVal === 0) {
//   processWt += issuedVal;
// }

//   received += receivedVal;
// });



// results.push({
//   process: p.name,
//   issued_wt: issued,
//   process_wt: processWt, // ✅ now has real value
//   received_wt: received,
//   // loss_wt: loss,
//   // scrap_wt: scrap,
//   // dust_wt: dust
// });


//     }

//     res.json({ success: true, data: results });

// console.log(results)

//   } catch (err) {
//     console.error("Error fetching process summary:", err);
//     res.status(500).json({ success: false, message: "Error fetching process summary", error: err.message });
    
//   }
// });



// ========================== Preview model =================================================================

// Get models for category  with category filter
// app.get("/api/previewModels", async (req, res) => {
//   const { categoryId } = req.query;
//   if (!categoryId) {
//     return res.status(400).json({ error: "categoryId is required" });
//   }

//   try {
//     const result = await conn.query(
//       `SELECT Id, Name, Image_URL__c,Category__c, Size__c, Gross_Weight__C, Net_Weight__c, Stone_Weight__c
//        FROM Jewlery_Model__c 
//        WHERE Category__c = '${categoryId}'
//        ORDER BY Name`
//     );
//     res.json(result.records);
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ error: "Failed to fetch models" });
//   }
// });
// Get models for category

// ===============================  generate model name ==========================================

async function generateModelName(category) {
  if (!category) throw new Error("Category is required");

  const match = category.match(/\(([^)]+)\)/);
  const shortCode = match
    ? match[1].trim().toUpperCase()
    : category.slice(0, 4).toUpperCase();

  // Query Salesforce for existing names
  const result = await conn.query(`
    SELECT Name__c FROM Jewlery_Model__c
    WHERE Name__c LIKE '${shortCode}-%'
  `);

  const existingNames = result.records.map(r => r.Name__c);

  console.log(existingNames);


  // Extract only the last number after '-'
  const numbers = existingNames.map(name => {
    const lastPart = name.split("-").pop(); // take last part
    const num = parseInt(lastPart, 10);
    return isNaN(num) ? 0 : num;
  });

  const nextNumber = numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
  return `${shortCode}-${nextNumber}`;
}


// API endpoint
app.post("/generate-model-name", async (req, res) => {
  try {
    const { category } = req.body;
    if (!category) {
      return res.status(400).json({ success: false, message: "Category is required" });
    }

    const modelName = await generateModelName(category);
    res.json({ success: true, modelName });
  } catch (err) {
    console.error("Error generating model name:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ========================================================================================================================================================

app.get("/getimage", async (req, res) => {
  const { fileUrl } = req.query;
  if (!fileUrl) {
    return res.status(400).json({ error: "fileUrl query param is required" });
  }

  try {
    const response = await axios.get(fileUrl, {
      responseType: "arraybuffer",
      headers: {
        Authorization: `Bearer ${process.env.SALESFORCE_ACCESS_TOKEN}`,
      },
    });

    // Detect image type (optional)
    const contentType =
      response.headers["content-type"] || "image/jpeg";
    res.setHeader("Content-Type", contentType);
    res.send(response.data);
  } catch (error) {
    console.error("Error fetching image:", error.message);
    res.status(500).json({ error: "Failed to fetch image" });
  }
});


// // GET Vendors
// app.get("/api/party-ledger", async (req, res) => {
//   try {
//     const records = await conn.query(`
//       SELECT Id, Name, Party_Code__c, Gst__c, Pan_Card__c, Address__c,
//              Pincode__c, Mobile_No__c, Email_ID__c, Account_Type__c
//       FROM Party_Ledger__c
//     `);

//     const vendors = records.records.map(r => ({
//       id: r.Id,
//       name: r.Name,
//       partyCode: r.Party_Code__c,
//       gstNo: r.Gst__c,
//       panNo: r.Pan_Card__c,
//       address: r.Address__c,
//       pincode: r.Pincode__c,
//       mobile: r.Mobile_No__c,
//       email: r.Email_ID__c,
//       accountType: r.Account_Type__c,
//     }));

//     res.json(vendors);
  
//   } catch (err) {
//     console.error("Error fetching vendors:", err);
//     res.status(500).json({ success: false, error: err.message });
//   }
// });

// GET Vendor Ledger
// GET Vendor Transactions
// app.get("/api/vendor-ledger", async (req, res) => {
//   try {
//     const { fromDate, toDate, partyId, orderId } = req.query;

//     // First query (Orders)
//     let orderQuery = `
//       SELECT Id, Name,Party_Name_c,Party_Code_c, Advance_Metal_c, Created_Date_c, Total_Weight_c,Status_c,Purity_c,Advance_Metal_Purity_c,Delivery_Date_c
// FROM Order__c
 
//     `;
// //  WHERE CreatedDate >= ${fromDate}T00:00:00Z
//      // AND CreatedDate <= ${toDate}T23:59:59Z
//     if (partyId) orderQuery += ` AND Party_Code__c = '${partyId}'`;
//     if (orderId) orderQuery += ` AND Order__c = '${orderId}'`;

//     const orders = await conn.query(orderQuery);

//     // For each order → fetch delivered weight
//     const transactions = await Promise.all(
//       orders.records.map(async (o) => {
//         const delivered = await conn.query(`
//          SELECT SUM(Total_Net_Weight__c) 
//           FROM Billing__c 
        
//         `);
// //  WHERE Party_Name__c = '${o.Party_Code__c}'
//         return {
//           id: o.Id,
//           orderId: o.Name,
//           party: o.Party_Code_c,
//           tranDate: o.Created_Date_c,
//           issuedWeight: o.Advance_Metal_c,
//           advanceMetalPurity: o.Advance_Metal_Purity_c,
//           deliveredWeight: delivered.records[0]?.expr0 || 0,
//           balanceWeight: (o.Advance_Metal_c || 0) - (delivered.records[0]?.expr0 || 0),
//         };
//       })
//     );

//     res.json(transactions);
//   } catch (err) {
//     console.error("Error fetching vendor transactions:", err);
//     res.status(500).json({ error: err.message });
//   }
// });

//<------------------------------------------------------- Correction APIs ----------------- */------------------------ //
// app.post("/api/correction/create", async (req, res) => { 
//   try {
//     const { 
//       correctionId,
//       issuedDate,
//       pouches,
//       totalWeight,
//       status,
//       product,
//       quantity,
//       orderId
//     } = req.body;

//     console.log('[Correction Create] Received data:', { 
//       correctionId,
//       issuedDate,
//       pouchCount: pouches.length,
//       totalWeight,
//       status,
//       product,
//       quantity,
//       orderId
//     });

//     // Create Correction record
//     const correctionResult = await conn.sobject('Correction_c__c').create({
//       Name: correctionId,
//       Issued_Date__c: issuedDate,
//       Issued_Weight__c: totalWeight,
//       Status__c: status,
//       Product__c: product,
//       Quantity__c: quantity,
//       Order_Id__c: orderId
//     });

//     console.log('[Correction Create] Correction record created:', correctionResult);

//     if (!correctionResult.success) {
//       throw new Error('Failed to create correction record');
//     }

//     // Update existing pouches
//     const pouchResults = await Promise.all(pouches.map(async pouch => {
//       console.log('[Correction Create] Updating pouch:', {
//         pouchId: pouch.pouchId,
//         weight: pouch.correctionWeight
//       });

//       const pouchResult = await conn.sobject('Pouch__c').update({
//         Id: pouch.pouchId,
//         Correction__c: correctionResult.id,
//         Isssued_Weight_Correction__c: pouch.correctionWeight,
//         Quantity__c: pouch.quantity
//       });

//       console.log('[Correction Create] Pouch updated:', pouchResult);
//       return pouchResult;
//     }));

//     res.json({
//       success: true,
//       message: "Correction record created successfully",
//       data: {
//         correctionId,
//         correctionRecordId: correctionResult.id,
//         pouches: pouchResults
//       }
//     });

//   } catch (error) {
//     console.error("[Correction Create] Error:", error);
//     console.error("[Correction Create] Full error details:", JSON.stringify(error, null, 2));
//     res.status(500).json({
//       success: false,
//       message: error.message || "Failed to create correction record"
//     });
//   }
// });


// app.get("/api/correction", async(req, res) => {
//   try {
//     const grindingQuery = await conn.query(
//        `SELECT Id, Name, Issued_Date__c, Issued_Weight__c,Received_Date__c,Received_Weight__c,Status__c,Grinding_loss__c,Product__c,Quantity__c,Order_Id__c,Grinding_Scrap_Weight__C,Grinding_Dust_Weight__c FROM Correction_c__c
//        ORDER BY Issued_Date__c DESC`
//     );

//     res.json({
//       success: true,
//       data: grindingQuery.records
//     });
//   } catch (error) {
//     console.error("Error fetching grinding records:", error); 
//     res.status(500).json({
//       success: false,
//       message: error.message || "Failed to fetch grinding records"
//     });
    
//   }
// });

// app.get("/api/correction/:prefix/:date/:month/:year/:number/:subnumber", async (req, res) => {
//   try {
//     const { prefix, date, month, year, number,subnumber } = req.params;
//     const correctionID = `${prefix}/${date}/${month}/${year}/${number}/${subnumber}`;
    
//     console.log('Requested Correction ID:', correctionID);

//     // Query for grinding details
//     const grindingQuery = await conn.query(
//       `SELECT 
//         Id,
//         Name,
//         Issued_Date__c,
//         Issued_Weight__c,
//         Received_Weight__c,
//         Received_Date__c,
//         Product__c,
//         Quantity__c,
//       	Order_Id__c,
//         status__c,
//         Grinding_loss__c
//        FROM Correction_c__c
//        WHERE Name = '${correctionID}'`
//     );

//     if (!grindingQuery.records || grindingQuery.records.length === 0) {
//       return res.status(404).json({
//         success: false,
//         message: "correction record not found"
//       });
//     }

//     const grinding = grindingQuery.records[0];

//     // Get Related Pouches
//     const pouchesQuery = await conn.query(
//       `SELECT 
//         Id,
//         Name,
//         Order_Id__c,
//         correction__c,
//         Isssued_Weight_Correction__c,
//         Product__c,
//         Quantity__c
//        FROM Pouch__c 
//        WHERE correction__c = '${grinding.Id}'`
//     );

//     const response = {
//       success: true,
//       data: {
//         grinding: grindingQuery.records[0],
//         pouches: pouchesQuery.records || []
//       }
//     };

//     res.json(response);

//   } catch (error) {
//     console.error("Error fetching grinding details:", error);
//     console.error("Full error details:", JSON.stringify(error, null, 2));
//     res.status(500).json({
//       success: false,
//       message: error.message || "Failed to fetch grinding details"
//     });
//   }
// });

/**-----------------Get all Grinding Details ----------------- */

app.get("/api/correction-details/:prefix/:date/:month/:year/:number/:subnumber", async (req, res) => {
  try {
    const { prefix, date, month, year, number,subnumber } = req.params;
    const grindingId = `${prefix}/${date}/${month}/${year}/${number}/${subnumber}`;


    // 1. Get Grinding details
    const grindingQuery = await conn.query(
      `SELECT 
        Id,
        Name,
        Issued_Date__c,
        Issued_Weight__c,
        Received_Weight__c,
        Received_Date__c,
        Status__c,
        Grinding_loss__c
       FROM Correction_c__c
       WHERE Name = '${grindingId}'`
    );

    if (!grindingQuery.records || grindingQuery.records.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Grinding record not found"
      });
    }

    const grinding = grindingQuery.records[0];

    // 2. Get Pouches for this grinding
    const pouchesQuery = await conn.query(
      `SELECT 
        Id,
        Name,
        Order_Id__c,
        Isssued_Weight_Correction__c
       FROM Pouch__c 
       WHERE correction__c = '${grinding.Id}'`
    );

    // 3. Get Orders for these pouches
    const orderIds = pouchesQuery.records.map(pouch => `'${pouch.Order_Id__c}'`).join(',');
    let orders = [];
    let models = [];

    if (orderIds.length > 0) {
      const ordersQuery = await conn.query(
        `SELECT 
          Id,
          Name,
          Order_Id__c,
          Party_Name__c,
          Delivery_Date__c,
          Status__c
         FROM Order__c 
         WHERE Order_Id__c IN (${orderIds})`
      );
      
      orders = ordersQuery.records;

      // 4. Get Models for these orders
      const orderIdsForModels = orders.map(order => `'${order.Id}'`).join(',');
      if (orderIdsForModels.length > 0) {
        const modelsQuery = await conn.query(
          `SELECT 
            Id,     
            Name,
            Order__c,
            Category__c,
            Purity__c,
            Size__c,
            Color__c,
            Quantity__c,
            Gross_Weight__c,
            Stone_Weight__c,
            Net_Weight__c
           FROM Order_Models__c 
           WHERE Order__c IN (${orderIdsForModels})`
        );
        
        models = modelsQuery.records;
      }
    }

    const response = {
      success: true,
      data: {
        grinding: grinding,
        pouches: pouchesQuery.records.map(pouch => {
          const relatedOrder = orders.find(order => order.Order_Id__c === pouch.Order_Id__c);
          const pouchModels = relatedOrder ? models.filter(model => 
            model.Order__c === relatedOrder.Id
          ) : [];

          return {
            ...pouch,
            order: relatedOrder || null,
            models: pouchModels
          };
        })
      },
      summary: {
        totalPouches: pouchesQuery.records.length,
        totalOrders: orders.length,
        totalModels: models.length,
        totalPouchWeight: pouchesQuery.records.reduce((sum, pouch) => 
          sum + (pouch.Isssued_Weight_Correction__c || 0), 0),
        issuedWeight: grinding.Issued_Weight__c,
        receivedWeight: grinding.Received_Weight__c,
        grindingLoss: grinding.Grinding_loss__c
      }
    };

    res.json(response);

  } catch (error) {
    console.error("Error fetching grinding details:", error);
    console.error("Full error details:", JSON.stringify(error, null, 2));
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch grinding details"
    });
  }
});

/**-----------------Update Grinding Received Weight ----------------- */
app.post("/api/correction/update/:prefix/:date/:month/:year/:number/:subnumber", async (req, res) => {
  try {
    const { prefix, date, month, year, number, subnumber } = req.params;

    const { receivedDate, receivedWeight, grindingLoss,findingReceived, scrapReceivedWeight, dustReceivedWeight, ornamentWeight, pouches } = req.body;

    const grindingNumber = `${prefix}/${date}/${month}/${year}/${number}/${subnumber}`;

    console.log('[Grinding Update] Received data:', { 
      grindingNumber, 
      receivedDate, 
      receivedWeight, 
      grindingLoss,
      scrapReceivedWeight,
      dustReceivedWeight,
      ornamentWeight,

      findingReceived,

      pouches 
    });

    // First get the Grinding record
    const grindingQuery = await conn.query(
      `SELECT Id, Name FROM Correction_c__c WHERE Name = '${grindingNumber}'`
    );

    if (!grindingQuery.records || grindingQuery.records.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Correction record not found"
      });
    }

    const grinding = grindingQuery.records[0];

    // Update the grinding record
    const updateData = {
      Id: grinding.Id,
      Received_Date__c: receivedDate,
      Received_Weight__c: receivedWeight,
      Grinding_loss__c: grindingLoss,
      Grinding_Scrap_Weight__c: scrapReceivedWeight,
      Grinding_Dust_Weight__c: dustReceivedWeight,
      Grinding_Ornament_Weight__c: ornamentWeight,

      Finding_Weight__c: findingReceived,

      Status__c: 'Finished'
    };

    const updateResult = await conn.sobject('Correction_c__c').update(updateData);

    if (!updateResult.success) {
      throw new Error('Failed to update grinding record');
    }

    // Update pouches if provided
    if (pouches && pouches.length > 0) {
      for (const pouch of pouches) {
        try {
          const pouchUpdateResult = await conn.sobject('Pouch__c').update({
            Id: pouch.pouchId,
            Received_Weight_Correction__c: pouch.receivedWeight,
            Correction_loss__c: grindingLoss
          });

          console.log(`[Grinding Update] Pouch update result for ${pouch.pouchId}:`, pouchUpdateResult);
        } catch (pouchError) {
          console.error(`[Grinding Update] Failed to update pouch ${pouch.pouchId}:`, pouchError);
          throw pouchError;
        }
      }
    }



    
 if (findingReceived > 0) {
      const findingInventoryQuery = await conn.query(
        `SELECT Id, Available_weight__c FROM Inventory_ledger__c 
       WHERE Item_Name__c = 'Finding' 
      AND Purity__c = '91.7%'`
      );

      if (findingInventoryQuery.records.length > 0) {
        const currentWeight =
          findingInventoryQuery.records[0].Available_weight__c || 0;
        const findingUpdateResult = await conn
          .sobject("Inventory_ledger__c")
          .update({
            Id: findingInventoryQuery.records[0].Id,
            Available_weight__c: currentWeight + findingReceived,
            Last_Updated__c: receivedDate
          });

        if (!findingUpdateResult.success) {
          throw new Error("Failed to update scrap inventory");
        }
      } else {;;
        const findingCreateResult = await conn
          .sobject("Inventory_ledger__c")
          .create({
            Name: "Finding",
            Item_Name__c: "Finding",
            Purity__c: grinding.Purity__c,
            Available_weight__c: findingReceived,
            Unit_of_Measure__c: "Grams",
            Last_Updated__c: receivedDate
          });

        if (!findingCreateResult.success) {
          throw new Error("Failed to create scrap inventory");
        }
      }
    }

    

    // Check if scrap inventory exists for this purity
    const scrapInventoryQuery = await conn.query(
      `SELECT Id, Available_weight__c FROM Inventory_ledger__c 
       WHERE Item_Name__c = 'scrap' 
       AND Purity__c = '91.7%'`
    );

    if (scrapReceivedWeight > 0) {
      if (scrapInventoryQuery.records.length > 0) {
        // Update existing scrap inventory
        const currentWeight = scrapInventoryQuery.records[0].Available_weight__c || 0;
        const scrapUpdateResult = await conn.sobject('Inventory_ledger__c').update({
          Id: scrapInventoryQuery.records[0].Id,
          Available_weight__c: currentWeight + scrapReceivedWeight,
          Last_Updated__c: receivedDate
        });

        if (!scrapUpdateResult.success) {
          throw new Error('Failed to update scrap inventory');
        }
      } else {
        // Create new scrap inventory
        const scrapCreateResult = await conn.sobject('Inventory_ledger__c').create({
          Name: 'Scrap',
          Item_Name__c: 'Scrap',
          Purity__c: grinding.Purity__c,
          Available_weight__c: scrapReceivedWeight,
          Unit_of_Measure__c: 'Grams',
          Last_Updated__c: receivedDate
        });

        if (!scrapCreateResult.success) {
          throw new Error('Failed to create scrap inventory');
        }
      }
    }

    // Check if dust inventory exists
    const dustInventoryQuery = await conn.query(
      `SELECT Id, Available_weight__c FROM Inventory_ledger__c 
       WHERE Item_Name__c = 'Dust' 
       AND Purity__c = '91.7%'`
    );

    if (dustReceivedWeight > 0) {
      if (dustInventoryQuery.records.length > 0) {
        // Update existing dust inventory
        const currentWeight = dustInventoryQuery.records[0].Available_weight__c || 0;
        const dustUpdateResult = await conn.sobject('Inventory_ledger__c').update({
          Id: dustInventoryQuery.records[0].Id,
          Available_weight__c: currentWeight + dustReceivedWeight,
          Last_Updated__c: receivedDate
        });

        if (!dustUpdateResult.success) {
          throw new Error('Failed to update dust inventory');
        }
      } else {
        // Create new dust inventory
        const dustCreateResult = await conn.sobject('Inventory_ledger__c').create({
          Name: 'Dust',
          Item_Name__c: 'Dust',
          Purity__c: grinding.Purity__c,
          Available_weight__c: dustReceivedWeight,
          Unit_of_Measure__c: 'Grams',
          Last_Updated__c: receivedDate
        });

        if (!dustCreateResult.success) {
          throw new Error('Failed to create dust inventory');
        }
      }
    }

    res.json({
      success: true,
      message: "Grinding record updated successfully",
      data: {
        grindingNumber,
        receivedDate,
        receivedWeight,
        grindingLoss,
        scrapReceivedWeight,
        dustReceivedWeight,
        ornamentWeight,
        status: 'Finished'
      }
    });

  } catch (error) {
    console.error("[Grinding Update] Error:", error);
    console.error("[Grinding Update] Full error details:", JSON.stringify(error, null, 2));
    res.status(500).json({
      success: false,
      message: error.message || "Failed to update grinding record"
    });
  }
});

app.get("/api/correction/:prefix/:date/:month/:year/:number/:subnumber/pouches", async (req, res) => {
  try {
    const { prefix, date, month, year, number, subnumber } = req.params;
    const grindingId = `${prefix}/${date}/${month}/${year}/${number}/${subnumber}`;
    
    console.log('[Get Pouches] Fetching pouches for grinding:', grindingId);

    // First get the Grinding record
    const grindingQuery = await conn.query(
      `SELECT Id FROM Correction_c__c WHERE Name = '${grindingId}'`
    );

    if (!grindingQuery.records || grindingQuery.records.length === 0) {
      console.log('[Get Pouches] Grinding not found:', grindingId);
      return res.status(404).json({
        success: false,
        message: "Correction record not found"
      });
    }

    // Get pouches with their IDs and issued weights
    const pouchesQuery = await conn.query(
      `SELECT 
        Id, 
        Name,
        Isssued_Weight_Correction__c,
        Received_Weight_Correction__c,
        Product__c,
        Quantity__c,
        Order_Id__c
       FROM Pouch__c 
       WHERE correction__c = '${grindingQuery.records[0].Id}'`
    );

    console.log('[Get Pouches] Found pouches:', pouchesQuery.records);

    res.json({
      success: true,
      data: {
        pouches: pouchesQuery.records
      }
    });

  } catch (error) {
    console.error("[Get Pouches] Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch pouches"
    });
  }
});



// ----------------- Get Media Process with Date Filter -----------------


// app.post("/api/media/create", async (req, res) => {
//   try {
//     const { 
//       grindingId,
//       issuedDate,
//       pouches,
//       totalWeight,
//       status,
//       product,
//       quantity,
//       orderId
//     } = req.body;

//     console.log('[Grinding Create] Received data:', { 
//       grindingId,
//       issuedDate,
//       pouchCount: pouches.length,
//       totalWeight,
//       status,
//       product,
//       quantity,
//       orderId
//     });

//     // First create the Grinding record
//     const grindingResult = await conn.sobject('Media__c').create({
//       Name: grindingId,
//       Issued_Date__c: issuedDate,
//       Issued_Weight__c: totalWeight,
//       Status__c: status,
//       Product__c:product,
//       Quantity__c:quantity,
//       Order_Id__c: orderId
//     });

//     console.log('[Grinding Create] Grinding record created:', grindingResult);

//     if (!grindingResult.success) {
//       throw new Error('Failed to create grinding record');
//     }

//     // Update existing pouches
//     const pouchResults = await Promise.all(pouches.map(async pouch => {
//       console.log('[Grinding Create] Updating pouch:', {
//         pouchId: pouch.pouchId,
//         weight: pouch.grindingWeight
//       });

//       const pouchResult = await conn.sobject('Pouch__c').update({
//         Id: pouch.pouchId,
//         Media__c: grindingResult.id,
//         	Isssued_Weight_Media__c: pouch.grindingWeight,
//         Quantity__c: pouch.quantity
//       });

//       console.log('[Grinding Create] Pouch updated:', pouchResult);
//       return pouchResult;
//     }));

//     res.json({
//       success: true,
//       message: "Grinding record created successfully",
//       data: {
//         grindingId: grindingId,
//         grindingRecordId: grindingResult.id,
//         pouches: pouchResults
//       }
//     });

//   } catch (error) {
//     console.error("[Grinding Create] Error:", error);
//     console.error("[Grinding Create] Full error details:", JSON.stringify(error, null, 2));
//     res.status(500).json({
//       success: false,
//       message: error.message || "Failed to create grinding record"
//     });
//   }
// });

// app.get("/api/media", async(req, res) => {
//   try {
//     const grindingQuery = await conn.query(
//        `SELECT Id, Name, Issued_Date__c, Issued_Weight__c,Received_Date__c,Received_Weight__c,Status__c,Grinding_loss__c,Product__c,Quantity__c,Order_Id__c,Grinding_Scrap_Weight__C,Grinding_Dust_Weight__c FROM Media__c
//        ORDER BY Issued_Date__c DESC`
//     );

//     res.json({
//       success: true,
//       data: grindingQuery.records
//     });
//   } catch (error) {
//     console.error("Error fetching grinding records:", error); 
//     res.status(500).json({
//       success: false,
//       message: error.message || "Failed to fetch grinding records"
//     });
//   }
// });

// app.get("/api/media/:prefix/:date/:month/:year/:number/:subnumber", async (req, res) => {
//   try {
//     const { prefix, date, month, year, number,subnumber } = req.params;
//     const grindingId = `${prefix}/${date}/${month}/${year}/${number}/${subnumber}`;
    
//     console.log('Requested Grinding ID:', grindingId);

//     // Query for grinding details
//     const grindingQuery = await conn.query(
//       `SELECT 
//         Id,
//         Name,
//         Issued_Date__c,
//         Issued_Weight__c,
//         Received_Weight__c,
//         Received_Date__c,
//         Product__c,
//         Quantity__c,
//       	Order_Id__c,
//         status__c,
//         Grinding_loss__c
//        FROM Media__c
//        WHERE Name = '${grindingId}'`
//     );

//     if (!grindingQuery.records || grindingQuery.records.length === 0) {
//       return res.status(404).json({
//         success: false,
//         message: "Grinding record not found"
//       });
//     }

//     const grinding = grindingQuery.records[0];

//     // Get Related Pouches
//     const pouchesQuery = await conn.query(
//       `SELECT 
//         Id,
//         Name,
//         Order_Id__c,
//         Media__c,
//         Isssued_Weight_Media__c,
//         Product__c,
//         Quantity__c
//        FROM Pouch__c 
//        WHERE Media__c = '${grinding.Id}'`
//     );

//     const response = {
//       success: true,
//       data: {
//         grinding: grindingQuery.records[0],
//         pouches: pouchesQuery.records || []
//       }
//     };

//     res.json(response);

//   } catch (error) {
//     console.error("Error fetching grinding details:", error);
//     console.error("Full error details:", JSON.stringify(error, null, 2));
//     res.status(500).json({
//       success: false,
//       message: error.message || "Failed to fetch grinding details"
//     });
//   }
// });

// app.get("/api/grinding-details/:prefix/:date/:month/:year/:number/:subnumber", async (req, res) => {
//   try {
//     const { prefix, date, month, year, number,subnumber } = req.params;
//     const grindingId = `${prefix}/${date}/${month}/${year}/${number}/${subnumber}`;

//     // 1. Get Grinding details
//     const grindingQuery = await conn.query(
//       `SELECT 
//         Id,
//         Name,
//         Issued_Date__c,
//         Issued_Weight__c,
//         Received_Weight__c,
//         Received_Date__c,
//         Status__c,
//         Grinding_loss__c
//        FROM Grinding__c
//        WHERE Name = '${grindingId}'`
//     );

//     if (!grindingQuery.records || grindingQuery.records.length === 0) {
//       return res.status(404).json({
//         success: false,
//         message: "Grinding record not found"
//       });
//     }

//     const grinding = grindingQuery.records[0];

//     // 2. Get Pouches for this grinding
//     const pouchesQuery = await conn.query(
//       `SELECT 
//         Id,
//         Name,
//         Order_Id__c,
//         Isssued_Weight_Grinding__c
//        FROM Pouch__c 
//        WHERE Grinding__c = '${grinding.Id}'`
//     );

//     // 3. Get Orders for these pouches
//     const orderIds = pouchesQuery.records.map(pouch => `'${pouch.Order_Id__c}'`).join(',');
//     let orders = [];
//     let models = [];

//     if (orderIds.length > 0) {
//       const ordersQuery = await conn.query(
//         `SELECT 
//           Id,
//           Name,
//           Order_Id__c,
//           Party_Name__c,
//           Delivery_Date__c,
//           Status__c
//          FROM Order__c 
//          WHERE Order_Id__c IN (${orderIds})`
//       );
      
//       orders = ordersQuery.records;

//       // 4. Get Models for these orders
//       const orderIdsForModels = orders.map(order => `'${order.Id}'`).join(',');
//       if (orderIdsForModels.length > 0) {
//         const modelsQuery = await conn.query(
//           `SELECT 
//             Id,     
//             Name,
//             Order__c,
//             Category__c,
//             Purity__c,
//             Size__c,
//             Color__c,
//             Quantity__c,
//             Gross_Weight__c,
//             Stone_Weight__c,
//             Net_Weight__c
//            FROM Order_Models__c 
//            WHERE Order__c IN (${orderIdsForModels})`
//         );
        
//         models = modelsQuery.records;
//       }
//     }

//     const response = {
//       success: true,
//       data: {
//         grinding: grinding,
//         pouches: pouchesQuery.records.map(pouch => {
//           const relatedOrder = orders.find(order => order.Order_Id__c === pouch.Order_Id__c);
//           const pouchModels = relatedOrder ? models.filter(model => 
//             model.Order__c === relatedOrder.Id
//           ) : [];

//           return {
//             ...pouch,
//             order: relatedOrder || null,
//             models: pouchModels
//           };
//         })
//       },
//       summary: {
//         totalPouches: pouchesQuery.records.length,
//         totalOrders: orders.length,
//         totalModels: models.length,
//         totalPouchWeight: pouchesQuery.records.reduce((sum, pouch) => 
//           sum + (pouch.Isssued_Weight_Grinding__c || 0), 0),
//         issuedWeight: grinding.Issued_Weight__c,
//         receivedWeight: grinding.Received_Weight__c,
//         grindingLoss: grinding.Grinding_loss__c
//       }
//     };

//     res.json(response);

//   } catch (error) {
//     console.error("Error fetching grinding details:", error);
//     console.error("Full error details:", JSON.stringify(error, null, 2));
//     res.status(500).json({
//       success: false,
//       message: error.message || "Failed to fetch grinding details"
//     });
//   }
// });





/**-----------------Get all Grinding Details ----------------- */
// app.get("/api/media-details/:prefix/:date/:month/:year/:number/:subnumber", async (req, res) => {
//   try {
//     const { prefix, date, month, year, number,subnumber } = req.params;
//     const grindingId = `${prefix}/${date}/${month}/${year}/${number}/${subnumber}`;

//     // 1. Get Grinding details
//     const grindingQuery = await conn.query(
//       `SELECT 
//         Id,
//         Name,
//         Issued_Date__c,
//         Issued_Weight__c,
//         Received_Weight__c,
//         Received_Date__c,
//         Status__c,
//         Grinding_loss__c
//        FROM Media__c
//        WHERE Name = '${grindingId}'`
//     );

//     if (!grindingQuery.records || grindingQuery.records.length === 0) {
//       return res.status(404).json({
//         success: false,
//         message: "Grinding record not found"
//       });
//     }

//     const grinding = grindingQuery.records[0];

//     // 2. Get Pouches for this grinding
//     const pouchesQuery = await conn.query(
//       `SELECT 
//         Id,
//         Name,
//         Order_Id__c,
//         Isssued_Weight_Media__c
//        FROM Pouch__c 
//        WHERE Grinding__c = '${grinding.Id}'`
//     );

//     // 3. Get Orders for these pouches
//     const orderIds = pouchesQuery.records.map(pouch => `'${pouch.Order_Id__c}'`).join(',');
//     let orders = [];
//     let models = [];

//     if (orderIds.length > 0) {
//       const ordersQuery = await conn.query(
//         `SELECT 
//           Id,
//           Name,
//           Order_Id__c,
//           Party_Name__c,
//           Delivery_Date__c,
//           Status__c
//          FROM Order__c 
//          WHERE Order_Id__c IN (${orderIds})`
//       );
      
//       orders = ordersQuery.records;

//       // 4. Get Models for these orders
//       const orderIdsForModels = orders.map(order => `'${order.Id}'`).join(',');
//       if (orderIdsForModels.length > 0) {
//         const modelsQuery = await conn.query(
//           `SELECT 
//             Id,     
//             Name,
//             Order__c,
//             Category__c,
//             Purity__c,
//             Size__c,
//             Color__c,
//             Quantity__c,
//             Gross_Weight__c,
//             Stone_Weight__c,
//             Net_Weight__c
//            FROM Order_Models__c 
//            WHERE Order__c IN (${orderIdsForModels})`
//         );
        
//         models = modelsQuery.records;
//       }
//     }

//     const response = {
//       success: true,
//       data: {
//         grinding: grinding,
//         pouches: pouchesQuery.records.map(pouch => {
//           const relatedOrder = orders.find(order => order.Order_Id__c === pouch.Order_Id__c);
//           const pouchModels = relatedOrder ? models.filter(model => 
//             model.Order__c === relatedOrder.Id
//           ) : [];

//           return {
//             ...pouch,
//             order: relatedOrder || null,
//             models: pouchModels
//           };
//         })
//       },
//       summary: {
//         totalPouches: pouchesQuery.records.length,
//         totalOrders: orders.length,
//         totalModels: models.length,
//         totalPouchWeight: pouchesQuery.records.reduce((sum, pouch) => 
//           sum + (pouch.Isssued_Weight_Grinding__c || 0), 0),
//         issuedWeight: grinding.Issued_Weight__c,
//         receivedWeight: grinding.Received_Weight__c,
//         grindingLoss: grinding.Grinding_loss__c
//       }
//     };

//     res.json(response);

//   } catch (error) {
//     console.error("Error fetching grinding details:", error);
//     console.error("Full error details:", JSON.stringify(error, null, 2));
//     res.status(500).json({
//       success: false,
//       message: error.message || "Failed to fetch grinding details"
//     });
//   }
// });

// app.post("/api/media/update/:prefix/:date/:month/:year/:number/:subnumber", async (req, res) => {
//   try {
//     const { prefix, date, month, year, number, subnumber } = req.params;

//     // Default missing numeric values to 0
//    let {
//   issuedWeight=0,
//   receivedDate,
//   receivedWeight=0,
//   grindingLoss=0,
//   ornamentWeight=0,
//   pouches=[]
// } = req.body;



// let findingReceived = Number(req.body.findingReceived || 0);
// let scrapReceivedWeight = Number(req.body.scrapReceivedWeight || req.body.scrapWeight || 0);
// let dustReceivedWeight  = Number(req.body.dustReceivedWeight  || req.body.dustWeight  || 0);
// console.log("[media Update editor ] Raw body:", req.body);

//     // Ensure numeric values
//     issuedWeight = Number(issuedWeight) || 0;
//     receivedWeight = Number(receivedWeight) || 0;
//     grindingLoss = Number(grindingLoss) || 0;
//     scrapReceivedWeight = Number(scrapReceivedWeight)  || 0;
//     dustReceivedWeight = Number(dustReceivedWeight)|| 0;
//     ornamentWeight = Number(ornamentWeight) || 0;

//     const grindingNumber = `${prefix}/${date}/${month}/${year}/${number}/${subnumber}`;


//     console.log("[Media Update] Received data:", {

//       issuedWeight,
//       grindingNumber,
//       receivedDate,
//       receivedWeight,
//       grindingLoss,
//       scrapReceivedWeight,
//       dustReceivedWeight,
//       ornamentWeight,

//       findingReceived,

//       pouches
//     });

//     /** ---- 1. Get Grinding Record ---- **/
//   const grindingQuery = await conn.query(
//    `SELECT Id, Name  FROM Media__c WHERE Name = '${grindingNumber}'`
// );


//     if (!grindingQuery.records || grindingQuery.records.length === 0) {
//       return res.status(404).json({
//         success: false,

//         message: "Media record not found"

//       });
//     }

//     const grinding = grindingQuery.records[0];

//     /** ---- 2. Update Grinding Record ---- **/
//     const updateData = {
//       Id: grinding.Id,
//       issued_Weight__c: issuedWeight,
//       Received_Date__c: receivedDate,
//       Received_Weight__c: receivedWeight,
//       Grinding_loss__c: grindingLoss,
//       Grinding_Scrap_Weight__c: scrapReceivedWeight,
//       Grinding_Dust_Weight__c: dustReceivedWeight,
//       Grinding_Ornament_Weight__c: ornamentWeight,

//       Finding_Weight__c: findingReceived,

//       Status__c: "Finished"
//     };

//     const updateResult = await conn.sobject("Media__c").update(updateData);

//     if (!updateResult.success) {
//       throw new Error("Failed to update grinding record");
//     }

//     /** ---- 3. Update Pouches ---- **/
//     if (Array.isArray(pouches) && pouches.length > 0) {
//       for (const pouch of pouches) {
//         try {
//           const pouchUpdateResult = await conn.sobject("Pouch__c").update({
//             Id: pouch.pouchId,
            
//             Received_Weight_media__c: Number(pouch.receivedWeight) || 0,
//             Media_Loss__c: grindingLoss
//           });

//           console.log(
//             `[Grinding Update] Pouch update result for ${pouch.pouchId}:`,
//             pouchUpdateResult
//           );
//         } catch (pouchError) {
//           console.error(
//             `[Grinding Update] Failed to update pouch ${pouch.pouchId}:`,
//             pouchError
//           );
//           throw pouchError;
//         }
//       }
//     }



//     if (findingReceived > 0) {
//       const findingInventoryQuery = await conn.query(
//         `SELECT Id, Available_weight__c FROM Inventory_ledger__c 
//        WHERE Item_Name__c = 'Finding' 
//       AND Purity__c = '91.7%'`
//       );

//       if (findingInventoryQuery.records.length > 0) {
//         const currentWeight =
//           findingInventoryQuery.records[0].Available_weight__c || 0;
//         const findingUpdateResult = await conn
//           .sobject("Inventory_ledger__c")
//           .update({
//             Id: findingInventoryQuery.records[0].Id,
//             Available_weight__c: currentWeight + findingReceived,
//             Last_Updated__c: receivedDate
//           });

//         if (!findingUpdateResult.success) {
//           throw new Error("Failed to update scrap inventory");
//         }
//       } else {;;
//         const findingCreateResult = await conn
//           .sobject("Inventory_ledger__c")
//           .create({
//             Name: "Finding",
//             Item_Name__c: "Finding",
//             Purity__c: grinding.Purity__c,
//             Available_weight__c: findingReceived,
//             Unit_of_Measure__c: "Grams",
//             Last_Updated__c: receivedDate
//           });

//         if (!findingCreateResult.success) {
//           throw new Error("Failed to create scrap inventory");
//         }
//       }
//     }



//     /** ---- 4. Scrap Inventory Update ---- **/
//     if (scrapReceivedWeight > 0) {
//       const scrapInventoryQuery = await conn.query(
//         `SELECT Id, Available_weight__c FROM Inventory_ledger__c 
//        WHERE Item_Name__c = 'Scrap' 
//       AND Purity__c = '91.7%'`
//       );

//       if (scrapInventoryQuery.records.length > 0) {
//         const currentWeight =
//           scrapInventoryQuery.records[0].Available_weight__c || 0;
//         const scrapUpdateResult = await conn
//           .sobject("Inventory_ledger__c")
//           .update({
//             Id: scrapInventoryQuery.records[0].Id,
//             Available_weight__c: currentWeight + scrapReceivedWeight,
//             Last_Updated__c: receivedDate
//           });

//         if (!scrapUpdateResult.success) {
//           throw new Error("Failed to update scrap inventory");
//         }
//       } else {
//         const scrapCreateResult = await conn
//           .sobject("Inventory_ledger__c")
//           .create({
//             Name: "Scrap",
//             Item_Name__c: "Scrap",
//             Purity__c: grinding.Purity__c,
//             Available_weight__c: scrapReceivedWeight,
//             Unit_of_Measure__c: "Grams",
//             Last_Updated__c: receivedDate
//           });

//         if (!scrapCreateResult.success) {
//           throw new Error("Failed to create scrap inventory");
//         }
//       }
//     }

//     /** ---- 5. Dust Inventory Update ---- **/
//     if (dustReceivedWeight > 0) {
//       const dustInventoryQuery = await conn.query(
//       `SELECT Id, Available_weight__c ,Purity__c FROM Inventory_ledger__c 
//      WHERE Item_Name__c = 'G Machine Dust' and Purity__c ='91.7%'`
//       );

//       if (dustInventoryQuery.records.length > 0) {
//         const currentWeight =
//           dustInventoryQuery.records[0].Available_weight__c || 0;
//         const dustUpdateResult = await conn
//           .sobject("Inventory_ledger__c")
//           .update({
//             Id: dustInventoryQuery.records[0].Id,
//             Available_weight__c: currentWeight + dustReceivedWeight,
//             Last_Updated__c: receivedDate
//           });

//         if (!dustUpdateResult.success) {
//           throw new Error("Failed to update dust inventory");
//         }
//       } else {
//         const dustCreateResult = await conn
//           .sobject("Inventory_ledger__c")
//           .create({
//             Name: "G Machine Dust",
//             Item_Name__c: "G Machine Dust",
//             Purity__c: grinding.Purity__c,
//             Available_weight__c: dustReceivedWeight,
//             Unit_of_Measure__c: "Grams",
//             Last_Updated__c: receivedDate
//           });



//         if (!dustCreateResult.success) {
//           throw new Error("Failed to create dust inventory");
//         }
//         console.log('[Grinding Update] Dust inventory created:', !dustCreateResult.success ? 'Failed' : 'Success');
//       }
//     } 

//     /** ---- 6. Response ---- **/
//     res.json({
//       success: true,
//       message: "Grinding record updated successfully",
//       data: {
//         grindingNumber,
//         receivedDate,
//         receivedWeight,
//         grindingLoss,
//         scrapReceivedWeight,
//         dustReceivedWeight,
//         ornamentWeight,
//         status: "Finished"
//       }
//     });
//   } catch (error) {
//     console.error("[Grinding Update] Error:", error);
//     res.status(500).json({
//       success: false,
//       message: error.message || "Failed to update grinding record"
//     });
//   }
// });

// app.get("/api/media/:prefix/:date/:month/:year/:number/:subnumber/pouches", async (req, res) => {
//   try {
//     const { prefix, date, month, year, number, subnumber } = req.params;
//     const grindingId = `${prefix}/${date}/${month}/${year}/${number}/${subnumber}`;
    
//     console.log('[Get Pouches] Fetching pouches for grinding:', grindingId);

//     // First get the Grinding record
//     const grindingQuery = await conn.query(
//       `SELECT Id FROM Media__c WHERE Name = '${grindingId}'`
//     );

//     if (!grindingQuery.records || grindingQuery.records.length === 0) {
//       console.log('[Get Pouches] Grinding not found:', grindingId);
//       return res.status(404).json({
//         success: false,
//         message: "Grinding record not found"
//       });
//     }

//     // Get pouches with their IDs and issued weights
//     const pouchesQuery = await conn.query(
//       `SELECT 
//         Id, 
//         Name,
//         Isssued_Weight_Media__c,
//         Received_Weight_Media__c,
//         Product__c,
//         Quantity__c,
//         Order_Id__c
//        FROM Pouch__c 
//        WHERE Media__c = '${grindingQuery.records[0].Id}'`
//     );

//     console.log('[Get Pouches] Found pouches:', pouchesQuery.records);

//     res.json({
//       success: true,
//       data: {
//         pouches: pouchesQuery.records
//       }
//     });

//   } catch (error) {
//     console.error("[Get Pouches] Error:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to fetch pouches"
//     });
//   }
// });

// ====================== Stone Master ================================ ==========================

// API Route: Create Stone Master Record
// app.post('/create/stone', async (req, res) => {
//   try {
//     const { type, color, shape, size, piece, weight } = req.body;

//     if (!type || !color || !shape || !size || !piece || !weight) {
//       return res.status(400).json({ success: false, message: 'All fields are required' });
//     }

//     console.log(type, color, shape, size, piece, weight);
//      // Insert into Salesforce (or SQL, depending on what you're using)
//     const newRecord = await conn.sobject("Stone_Master__c").create({
//      Type__c: type,
//       Colour__c: color,
//       Shape__c: shape,
//       Size__c: size,
//       Pieces__c: piece,
//       Weight__c: weight,
//     });

//     res.json({ success: true, id: newRecord.id, ...req.body });

//   } catch (err) {
//     console.error('Server error:', err);
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// Inventory summary API
// app.get('/stonesummary', async (req, res) => {
//   try {
//     console.log("Fetching stone summary...");

//     const query = `
//       SELECT Type__c, SUM(Pieces__c) totalPieces, SUM(Weight__c) totalWeight
//       FROM Stone_Master__c
//       GROUP BY Type__c
//     `;

//     const result = await conn.query(query);

//     console.log("Salesforce query result:", result);

//     const summary = result.records.map((record) => ({
//       type: record['Type__c'],
//       totalPieces: parseFloat(record['totalPieces']) || 0,
//       totalWeight: parseFloat(record['totalWeight']) || 0,
//     }));

//     res.json({ success: true, summary });
//   } catch (err) {
//     console.error('Error fetching inventory summary:', err);
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

app.get("/api/stones", async (req, res) => {
  try {
    const result = await conn.sobject("Stone_Master__c")
      .find({}, "Id, Name, Type__c, Colour__c, Shape__c, Size__c, Pieces__c, Weight__c")
      .execute();

    res.json({ success: true, data: result });
  } catch (error) {
    console.error("Error fetching stones:", error);
    res.json({ success: false, message: "Failed to fetch stones" });
  }
});

// routes/treeCasting.js
// app.post("/tree-casting", async (req, res) => {
//   try {
//     const {
//       Name,
//       Tree_Weight__c,
//       orderId__c,
//       stones = []
//     } = req.body;

//     if (!stones.length) {
//       return res.json({ success: false, message: "No stones selected" });
//     }

//     // 1️⃣ Create the parent Tree Casting
//     const newTree = await conn.sobject("castingTree__c").create({
//       Name,
//       Tree_Weight__c,
//       stone_type__c: stones.map(s => s.type || "unknown").join(", "),
//       stone_color__c: stones.map(s => s.color || "unknown").join(", "),
//       stone_shape__c: stones.map(s => s.shape || "unknown").join(", "),
//       stone_weight__c: stones.reduce((sum, s) => sum + (parseFloat(s.weight) || 0), 0),
//       orderId__c,
//       status__c: "Pending",
//       issued_Date__c: new Date().toISOString().split("T")[0]
//     });

//     if (!newTree.success) {
//       return res.json({ success: false, message: "Failed to create Tree Casting" });
//     }

//     console.log("✅ Tree Casting created with ID:", newTree.id);

//     // 2️⃣ For each stone, create a child record in TreeStone__c
//     for (const stone of stones) {
//       await conn.sobject("TreeStone__c").create({
//         castingTree__c: newTree.id,     // parent relation
//         Stone_Master__c: stone.id || null, // optional lookup
//         Name: stone.name || "Unnamed Stone",
//         Type__c: stone.type || "",
//         Colour__c: stone.color || "",
//         Shape__c: stone.shape || "",
//         Size__c: stone.size || "",
//         Pieces__c: stone.pcs || 0,
//         Weight__c: parseFloat(stone.weight) || 0
//       });

//       // 3️⃣ Update stone stock only if Id exists
//       if (stone.id) {
//         const dbStone = await conn.sobject("Stone_Master__c")
//           .findOne({ Id: stone.id }, "Id, Weight__c");

//         if (dbStone) {
//           const updatedWeight = (dbStone.Weight__c || 0) - (parseFloat(stone.weight) || 0);
//           if (updatedWeight >= 0) {
//             await conn.sobject("Stone_Master__c").update({
//               Id: dbStone.Id,
//               Weight__c: updatedWeight
//             });
//           }
//         }
//       } else {
//         console.warn(`⚠️ Skipping inventory update for stone without Id (name=${stone.name || "unknown"})`);
//       }
//     }

//     res.json({ success: true, data: newTree });
//   } catch (error) {
//     console.error("❌ Error saving tree casting:", error);
//     res.json({ success: false, message: "Server error" });
//   }
// });




  // GET /casting-trees
// app.get("/casting-trees", async (req, res) => {
//   try {
//     const trees = await conn.query(`
//       SELECT Id, Name, Tree_Weight__c,issued_Date__c, OrderID__C,stone_weight__c,status__c
//       FROM CastingTree__c where status__c='Pending'
//       ORDER BY CreatedDate DESC
//       LIMIT 50
//     `);
//     res.json({ success: true, data: trees.records });
//   } catch (error) {
//     console.error("Error fetching trees:", error);
//     res.status(500).json({ success: false, message: "Failed to fetch trees" });
//   }
// });


// app.get("/casting-trees/all", async (req, res) => {
//   try {
//     const trees = await conn.query(`
//       SELECT Id, Name, Tree_Weight__c,issued_Date__c, OrderID__C,stone_color__c,stone_name__c,
//       stone_pcs__c,stone_shape__c,stone_size__c,stone_type__c,status__c,stone_weight__c
//       FROM CastingTree__c
//       ORDER BY CreatedDate DESC
//       LIMIT 50
//     `);
//     res.json({ success: true, data: trees.records });
//   } catch (error) {
//     console.error("Error fetching trees:", error);
//     res.status(500).json({ success: false, message: "Failed to fetch trees" });
//   }
// });




// app.post("/api/media-record/create", async (req, res) => {
//   try {
//     const { 
//       grindingId,  
//       issuedWeight, 
//       issuedDate, 
//       pouches,
//       orderId,
//       quantity,
//       name
        
//     } = req.body;



//     // First create the Grinding record
//     const grindingResult = await conn.sobject('Media__C').create({
//       Name: grindingId,
//       Issued_Weight__c: issuedWeight,
//       Issued_Date__c: issuedDate,
//       Status__c: 'In progress',
//       Product__C : name,
//       Order_Id__c: orderId,
//       Quantity__c : quantity

//     });

//     console.log('Media creation result:', grindingResult);

//     if (!grindingResult.success) {
//       throw new Error('Failed to create Media record');
//     }

//     // Create WIP pouches
//     const pouchRecords = pouches.map(pouch => ({
//       Name: pouch.pouchId,
//       Media__c: grindingResult.id,
//       Order_Id__c: pouch.orderId,
//       Isssued_Weight_media__c: pouch.weight,
//       Product__c : pouch.name,
//       Quantity__c: pouch.quantity
//     }));

//     console.log('Creating pouches:', pouchRecords);


//     const pouchResults = await conn.sobject('Pouch__c').create(pouchRecords);
//     console.log('Pouch creation results:', pouchResults);


//     // Add this section to create pouch items with clear logging
//     if (Array.isArray(pouchResults)) {
//       console.log('Starting pouch items creation...');
      

//       const pouchItemPromises = pouchResults.map(async (pouchResult, index) => {
//         console.log(`Processing pouch ${index + 1}:`, pouchResult);
        

//         if (pouches[index].categories && pouches[index].categories.length > 0) {
//           console.log(`Found ${pouches[index].categories.length} categories for pouch ${index + 1}`);
          
//           const pouchItemRecords = pouches[index].categories.map(category => {
//             const itemRecord = {
//               Name: category.category,
//               WIPPouch__c: pouchResult.id,
//               Category__c: category.category,
//               Quantity__c: category.quantity
//             };
//             console.log('Creating pouch item:', itemRecord);
//             return itemRecord;
//           });

//           try {
//             console.log(`Attempting to create ${pouchItemRecords.length} pouch items`);
//             const itemResults = await conn.sobject('Pouch_Items__c').create(pouchItemRecords);
            
//             if (Array.isArray(itemResults)) {
//               itemResults.forEach((result, i) => {
//                 if (result.success) {
//                   console.log(`Pouch item ${i + 1} created successfully:`, result);
//                 } else {
//                   console.error(`Pouch item ${i + 1} creation failed:`, result.errors);
//                 }
//               });

//             } else {
//               if (itemResults.success) {
//                 console.log('Single pouch item created successfully:', itemResults);
//               } else {
//                 console.error('Single pouch item creation failed:', itemResults.errors);
//               }
//             }
            
//             return itemResults;
//           } catch (error) {
//             console.error('Error in pouch items creation:', error.message);
//             console.error('Full error:', error);
//             throw error;
//           }
//         } else {
//           console.log(`No categories found for pouch ${index + 1}`);
//         }
//       });

//       console.log('Waiting for all pouch items to be created...');
//       const pouchItemResults = await Promise.all(pouchItemPromises);
//       console.log('All pouch items creation completed:', pouchItemResults);
//     }

//     res.json({
//       success: true,
//       message: "Grinding record created successfully",
//       data: {
//         grindingId,
//         grindingRecordId: grindingResult.id,
//         pouches: pouchResults
//       }
//     });

//   } catch (error) {
//     console.error("Error creating grinding record:", error);
//     console.error("Full error details:", JSON.stringify(error, null, 2));
//     res.status(500).json({
//       success: false,
//       message: error.message || "Failed to create grinding record"
//     });
//   }
// });





// =========================================================================================================================
// =========================================================================================================================
// ================================================     SQL CONNECTION    ==================================================
// =========================================================================================================================
// =========================================================================================================================



app.get("/customer-groups", checkSalesforceConnection, async (req, res) => {

  console.log("get party start");
  try {
    const pool = req.mssql;
    const query = `
      SELECT Id,Party_Code_c
      FROM Party_Ledger__c
      ORDER BY Party_Code_c
    `;
    const result = await pool.request().query(query);

    if (result.recordset.length === 0) {
      return res.status(404).json({ success: false, message: "No customer groups found." });
    }

    res.json({ success: true, data: result.recordset });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});


// app.get('/api/getLastOrderNumber', checkSalesforceConnection, async (req, res) => {
//   const { partyLedgerValue } = req.query;


//   console.log("party value", partyLedgerValue);

//    const pool = req.mssql;

//   if (!partyLedgerValue) {
//       return res.status(400).json({
//           success: false,
//           message: 'partyLedgerValue is required'
//       });
//   }

//   try {
//       // Query to fetch the latest order for the given PartyLedger
//       const query = `
//           SELECT Order_Id_c 
//           FROM Order__c
//           WHERE Party_Ledger_c IN (
//               SELECT Id 
//               FROM Party_Ledger__c 
//               WHERE Party_Code_c = '${partyLedgerValue}'
//           )
//           ORDER BY CreatedDate DESC
         
//       `;

//      const result = await pool.request().query(query);
//       console.log('Query result:', result); // Debug log

//       if (result.recordset.length === 0) {
//           // No previous orders found, return null to let frontend start from 0001
//           return res.json({
//               success: true,
//               lastOrderNumber: null  // Changed from '${partyLedgerValue}/0000'
//           });
//       }

//       const lastOrderNumber = result.recordset[0].Order_Id__c;
//       console.log('Last order number:', lastOrderNumber); // Debug log

//       res.json({
//           success: true,
//           lastOrderNumber
//       });

//   } catch (error) {
//       console.error('Salesforce Query Error:', error);
//       res.status(500).json({
//           success: false,
//           message: 'Error fetching order number',
//           error: error.message
//       });
//   }
// });

/** ----------------- Jewelry Category ------------------ **/

  app.get("/category-groups", checkSalesforceConnection, async (req, res) => {
  try {
    const pool = req.mssql;
    const query = `
      SELECT Id, Name
      FROM Jewelry_Category__c
      ORDER BY Name
    `;
    const result = await pool.request().query(query);

    if (result.recordset.length === 0) {
      return res.status(404).json({ success: false, message: "No Category groups found." });
    }

    res.json({ success: true, data: result.recordset });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get("/api/previewModels", checkSalesforceConnection, async (req, res) => {
  const { categoryId } = req.query;
  if (!categoryId) {
    return res.status(400).json({ error: "categoryId is required" });
  }
  try {
     const pool = req.mssql;
     console.log(categoryId);
    const result = await pool.request().query(
      `SELECT Id, Name, Image_URL_c,Category_c, Size_c, Gross_Weight_C, Net_Weight_c, Stone_Weight_c
       FROM Jewlery_Model__c 
       WHERE Category_c = '${categoryId}'
       ORDER BY Name`
    );
    res.json(result.recordset);

    console.log(result.recordset);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch models" });
  }
});

//#region model master phase

// Fetch Item Groups
app.get("/item-groups", checkMssqlConnection, async (req, res) => {
  try {
     const pool = req.mssql;
    const query = `
      SELECT Id, ItemGroupName_c
      FROM ItemGroup__c
      ORDER BY ItemGroupName_c
    `;
    const result = await pool.request().query(query);

    if (result.recordset.length === 0) {
      return res.status(404).json({ success: false, message: "No item groups found." });
    }

    res.json({ success: true, data: result.recordset });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

  // Add Jewelry Model
app.post("/api/add-jewelry", checkMssqlConnection, upload.single("item-image"), async (req, res) => {
  try {
    console.log("📦 Received a request to add a jewelry model");

    // ✅ Parse JSON safely
    let jewelryModelData, stoneDetailsData;
    try {
      jewelryModelData = JSON.parse(req.body.jewelryModel || "{}");
      stoneDetailsData = JSON.parse(req.body.stoneDetails || "[]");
    } catch (parseError) {
      return res.status(400).json({
        success: false,
        message: "Invalid JSON format.",
        error: parseError.message,
      });
    }

     const pool = req.mssql;

    // ✅ Validate jewelry model data
    if (!jewelryModelData || Object.keys(jewelryModelData).length === 0) {
      return res.status(400).json({
        success: false,
        message: "Jewelry model data is required.",
      });
    }

    // ✅ Create jewelry model (Salesforce + local file)
    const jewelryModelResult = await addJewelryModel(req, jewelryModelData, req.file);

    if (!jewelryModelResult.success) {
      return res.status(500).json({
        success: false,
        message: "Failed to create Jewelry Model",
        details: jewelryModelResult,
      });
    }

    const { recordName } = jewelryModelResult;

    // ✅ Insert stone details into MSSQL if available
    if (Array.isArray(stoneDetailsData) && stoneDetailsData.length > 0) {
      console.log(`🪨 Inserting ${stoneDetailsData.length} stone records for model ${recordName}...`);

      const stoneInsertQuery = `
        INSERT INTO Stone_Details__c (Name, Stone_Type_c, Color_c, Stone_Size_c, Quantity_c, JewelryModel_c)
        VALUES (@name, @type, @color, @size, @quantity, @model)
      `;

      for (const stone of stoneDetailsData) {
        await pool.request()
          .input("name", stone.name)
          .input("type", stone.type)
          .input("color", stone.color)
          .input("size", stone.size)
          .input("quantity", stone.quantity)
          .input("model", recordName)
          .query(stoneInsertQuery);
      }
    } else {
      console.log("ℹ️ No stone details provided.");
    }

    // ✅ Final Success Response
    return res.status(200).json({
      success: true,
      message: "Jewelry model and stone details added successfully",
      recordName
    });

  } catch (error) {
    console.error("❌ Error in /api/add-jewelry:", error);
    return res.status(500).json({
      success: false,
      message: "Unexpected server error",
      error: error.message,
    });
  }
});



//#endregion

//#region ============       stome master     =======================


// get stone type API
app.get('/api/StoneMaster', checkSalesforceConnection, async (req, res) => {
  try {
    const pool = req.mssql;
    console.log("Fetching stone details...");

    const query = `
      SELECT id, type_c, colour_c, size_c, Shape_c, pieces_c, weight_c
      FROM Stone_Master__c
    `;

    const result = await pool.request().query(query);

    console.log("Salesforce query result:", result.recordset);

    res.json({
      success: true,
      result: { records: result.recordset } // ✅ matches frontend structure
    });
  } catch (err) {
    console.error('Error fetching stone master:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ====================== Stone Master ============================

// API Route: Create Stone Master Record
app.post('/create/stone', checkSalesforceConnection, async (req, res) => {
  try {
    const pool = req.mssql;

    const { type, color, shape, size, piece, weight } = req.body;

    // ✅ Validate required fields
    if (!type || !color || !shape || !size || !piece || !weight) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required',
      });
    }

    console.log("Inserting stone:", { type, color, shape, size, piece, weight });

    // ✅ INSERT query (parameterized for safety)
    const insertQuery = `
      INSERT INTO Stone_Master__c (type_c, colour_c, Shape_c, size_c, pieces_c, weight_c, CreatedDate)
      OUTPUT INSERTED.id
      VALUES (@type, @color, @shape, @size, @piece, @weight, getdate())
    `;

    // ✅ Use parameterized request to avoid SQL injection
    const request = pool.request();
    request.input('type', type);
    request.input('color', color);
    request.input('shape', shape);
    request.input('size', size);
    request.input('piece', piece);
    request.input('weight', weight);

    // ✅ Execute the query and return inserted record ID
    const result = await request.query(insertQuery);
    const insertedId = result.recordset[0].id;

    res.status(201).json({
      success: true,
      message: 'Stone record inserted successfully',
      id: insertedId,
      data: { type, color, shape, size, piece, weight },
    });
  } catch (err) {
    console.error('Error inserting stone record:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});


// Inventory summary API
app.get('/stonesummary', checkSalesforceConnection, async (req, res) => {
  try {
    const pool = req.mssql;

    console.log("Fetching stone summary...");

    const query = `
      SELECT Type_c, SUM(Pieces_c) AS totalPieces, SUM(Weight_c) AS totalWeight
      FROM Stone_Master__c
      GROUP BY Type_c
    `;

    const result = await pool.request().query(query);

    console.log("Stone summary result:", result.recordset);

    const summary = result.recordset.map((record) => ({
      type: record.Type_c,
      totalPieces: parseFloat(record.totalPieces) || 0,
      totalWeight: parseFloat(record.totalWeight) || 0,
    }));

    res.json({ success: true, summary });
  } catch (err) {
    console.error('Error fetching inventory summary:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});


app.get("/api/stones", async (req, res) => {
  try {
    const result = await conn.sobject("Stone_Master__c")
      .find({}, "Id, Name, Type__c, Colour__c, Shape__c, Size__c, Pieces__c, Weight__c")
      .execute();

    res.json({ success: true, data: result });
  } catch (error) {
    console.error("Error fetching stones:", error);
    res.json({ success: false, message: "Failed to fetch stones" });
  }
});

//#endregion ========================================================================================

//#region   ==============        Vendor Master     ==========================

app.post("/api/party-ledger", checkSalesforceConnection, async (req, res) => {
  try {
    const pool = req.mssql;

    const {
      name,
      partyCode,
      gstNo,
      panNo,
      address,
      pincode,
      mobile,
      email,
      accountType,
    } = req.body;

    // ✅ Validation
    if (
      !name ||
      !partyCode ||
      !gstNo ||
      !panNo ||
      !address ||
      !pincode ||
      !mobile ||
      !email ||
      !accountType
    ) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    console.log("Inserting new party ledger:", req.body);

    // ✅ Parameterized SQL Insert Query
    const insertQuery = `
      INSERT INTO Party_Ledger__c 
        (Name, Party_Code_c, Gst_c, Pan_Card_c, Address_c, Pincode_c, Mobile_no_c, Email_ID_c, Account_Type_c, createdDate)
      OUTPUT INSERTED.Id
      VALUES
        (@name, @partyCode, @gstNo, @panNo, @address, @pincode, @mobile, @Email, @accountType, getdate())
    `;

    // ✅ Bind parameters to prevent SQL injection
    const request = pool.request();
    request.input("name", name);
    request.input("partyCode", partyCode);
    request.input("gstNo", gstNo);
    request.input("panNo", panNo);
    request.input("address", address);
    request.input("pincode", pincode);
    request.input("mobile", mobile);
    request.input("Email", email);
    request.input("accountType", accountType);

    // ✅ Execute the query
    const result = await request.query(insertQuery);
    const insertedId = result.recordset[0].Id;

    // ✅ Success response
    res.status(201).json({
      success: true,
      message: "Party ledger inserted successfully",
      id: insertedId,
      data: req.body,
    });
  } catch (err) {
    console.error("Error inserting party ledger:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET Vendors
app.get("/api/party-ledger", checkSalesforceConnection, async (req, res) => {
  try {    
    const pool = req.mssql;

    const records = await pool.request().query(`
      SELECT Id, Name, Party_Code_c, Gst_c, Pan_Card_c, Address_c,
             Pincode_c, Mobile_No_c, Email_ID_c, Account_Type_c
      FROM Party_Ledger__c
    `);

    const vendors = records.recordset.map(r => ({
      id: r.Id,
      name: r.Name,
      partyCode: r.Party_Code_c,
      gstNo: r.Gst_c,
      panNo: r.Pan_Card_c,
      address: r.Address_c,
      pincode: r.Pincode_c,
      mobile: r.Mobile_No_c,
      email: r.Email_ID_c,
      accountType: r.Account_Type_c,
    }));

    res.json(vendors);
  
  } catch (err) {
    console.error("Error fetching vendors:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

//#endregion    ==============================================================


//#region   ===========       Update Inventory      ==========================

// get inventory
app.get("/get-inventory", checkMssqlConnection ,async (req, res) => {
  try {
    const pool = req.mssql;
    // Query to fetch inventory items with their names and available weights

    const query = `
     SELECT 
        Name,
        Item_Name_c,
        Available_weight_c,
        Purity_c
      FROM Inventory_ledger__c
      ORDER BY Name ASC
    `;

   const result = await pool.request().query(query);

    if (!result.recordset) {
      return res.status(404).json({
        success: false,
        message: "No inventory items found"
      });
    }

    // Format the response data
    const inventoryItems = result.recordset.map(item => ({
      name: item.Item_Name_c,
      availableWeight: item.Available_weight_c,
      purity: item.Purity_c
    }));

    res.status(200).json({
      success: true,
      message: "Inventory items fetched successfully",
      data: inventoryItems
    });

  } catch (error) {
    console.error("Error fetching inventory:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch inventory items"
    });
  }
});


// app.get("/get-inventory", checkMssqlConnection ,async (req, res) => {
//   try {
//     const pool = req.mssql;
//     // Query to fetch inventory items with their names and available weights
//  const { partycode } = req.query; 
//     const query = `
//      SELECT 
//         Name,
//         Item_Name_c,
//         Available_weight_c,
//         Purity_c
//       FROM Inventory_ledger__c where PartyLedger_c=${partycode}
//       ORDER BY Name ASC
//     `;


//    const result = await pool.request().query(query);

//     if (!result.recordset) {
//       return res.status(404).json({
//         success: false,
//         message: "No inventory items found"
//       });
//     }

//     // Format the response data
//     const inventoryItems = result.recordset.map(item => ({
//       name: item.Item_Name_c,
//       availableWeight: item.Available_weight_c,
//       purity: item.Purity_c
//     }));

//     res.status(200).json({
//       success: true,
//       message: "Inventory items fetched successfully",
//       data: inventoryItems
//     });

//   } catch (error) {
//     console.error("Error fetching inventory:", error);
//     res.status(500).json({
//       success: false,
//       message: error.message || "Failed to fetch inventory items"
//     });
//   }
// });

// update the inventory / create inventory item
app.post("/update-inventory", checkMssqlConnection, async (req, res) => {
  try {
    const { itemName, purity, availableWeight, unitOfMeasure, partyLedger } = req.body;

    console.log('Received inventory update request:', {
      itemName,
      purity,
      availableWeight,
      unitOfMeasure,
      partyLedger
    });

    if (!itemName || !purity || !availableWeight || !unitOfMeasure || !partyLedger) {
      return res.status(400).json({
        success: false,
        message: "All fields are required"
      });
    }

    const pool = req.mssql;

    // Check if item exists
    const checkResult = await pool.request()
      .input("itemName", sql.NVarChar, itemName)
      .input("purity", sql.NVarChar, purity)
      .input("partyledger", sql.NVarChar, partyLedger)
      .query(`
        SELECT Id, Available_weight_c, Unit_of_Measure_c
        FROM Inventory_ledger__c
        WHERE Item_Name_c = @itemName AND Purity_c = @purity AND PartyLedger_c = @partyledger
      `);

      console.log(" result : ", checkResult.recordset);

    let result;
    let responseData = {};

    if (checkResult.recordset.length > 0) {
      const currentRecord = checkResult.recordset[0];
      const currentWeight = parseFloat(currentRecord.Available_weight || 0);
      const newTotalWeight = currentWeight + parseFloat(availableWeight);

      // Update existing record
      await pool.request()
        .input("id", sql.Int, currentRecord.Id)
        .input("weight", sql.Float, newTotalWeight)
        .input("unit", sql.NVarChar, unitOfMeasure)
        .input("partyledger", sql.NVarChar, partyLedger)
        .input("updated", sql.DateTime, new Date())
        .query(`
          UPDATE Inventory_ledger__c
          SET Available_weight_c = @weight,
              Unit_of_Measure_c = @unit,
              Last_Updated_c = @updated
          WHERE Id = @id AND PartyLedger_c = @partyledger
        `);

      result = { success: true };
      responseData = {
        currentWeight,
        addedWeight: parseFloat(availableWeight),
        newTotalWeight
      };
    } else {
      // Insert new record
      await pool.request()
        .input("itemName", sql.NVarChar, itemName)
        .input("purity", sql.NVarChar, purity)
        .input("weight", sql.Float, parseFloat(availableWeight))
        .input("unit", sql.NVarChar, unitOfMeasure)
        .input("partyledger", sql.NVarChar, partyLedger)
        .input("updated", sql.DateTime, new Date())
        .query(`
          INSERT INTO Inventory_ledger__c 
          (Name,Item_Name_c, Purity_c, Available_weight_c, Unit_of_Measure_c, Last_Updated_c, PartyLedger_c, CreatedDate)
          VALUES (@itemName, @itemName, @purity, @weight, @unit, @updated, @partyledger, getdate())
        `);

      result = { success: true };
      responseData = {
        currentWeight: 0,
        addedWeight: parseFloat(availableWeight),
        newTotalWeight: parseFloat(availableWeight)
      };
    }

    res.status(200).json({
      success: true,
      message: "Inventory updated successfully",
      data: responseData
    });

  } catch (error) {
    console.error("Error updating inventory:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update inventory",
      error: error.message
    });
  }
});

//#endregion    ==============================================================

//#region   ===========       Design Bank       ==============================

app.get("/api/previewModelsAll", checkMssqlConnection, async (req, res) => {

  try {    
    const pool = req.mssql; 

    const result = await pool.request().query(
      `SELECT Id, Name, Image_URL_c,Category_c, Size_c, Gross_Weight_C, Net_Weight_c, Stone_Weight_c 
       FROM Jewlery_Model__c 
       ORDER BY Name`
    );
    res.json(result.recordset);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch models" });
  }
});

//#endregion      ============================================================

//#region   ===========       Reports       ==================================

// inventory transactions

app.get("/get-inventory-transactions", checkMssqlConnection, async (req, res) => {
  try {

    const pool = req.mssql;
    // Query Salesforce for issued inventory records
    const result = await pool.request().query(`
      SELECT 
        Id,
        Name,
        Issued_Date_c,
        Purity_c,
        Pure_Metal_weight_c,
        Alloy_Weight_c,
        CreatedDate,
        CreatedBy_Name
      FROM Issued_inventory__c
      ORDER BY CreatedDate ASC
    `);

    if (!result.recordset || result.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Inventory Issued records not found"
      });
    }

    // Map Salesforce data to desired JSON format
    const inventoryItems = result.recordset.map(item => ({
      id: item.Id,
      name: item.Name,
      purity: item.Purity_c,
      issuedDate: item.Issued_Date_c,
      pureMetalWeight: item.Pure_Metal_weight_c,
      alloyWeight: item.Alloy_Weight_c,
      createdDate: item.CreatedDate,
      createdByName: item.CreatedBy?.Name || null
    }));

    res.status(200).json({
      success: true,
      message: "Inventory Transaction items fetched successfully",
      data: inventoryItems
    });

  } catch (error) {
    console.error("Error fetching inventory:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch inventory items"
    });
  }
});

// party ledger
app.get("/api/vendor-ledger", checkMssqlConnection, async (req, res) => {
  try {
    const { fromDate, toDate, partyId, orderId } = req.query;
    const pool = req.mssql;

    // 1️⃣ Build dynamic WHERE conditions
    let conditions = "WHERE 1=1";
    if (fromDate) conditions += ` AND Created_Date_c >= '${fromDate}'`;
    if (toDate) conditions += ` AND Created_Date_c <= '${toDate}'`;
    if (partyId) conditions += ` AND Party_Code_c = '${partyId}'`;
    if (orderId) conditions += ` AND Name = '${orderId}'`;

    // 2️⃣ Fetch Orders
    const orderQuery = `
      SELECT 
        Id,
        Name AS OrderId,
        Party_Name_c,
        Party_Code_c,
        Advance_Metal_c,
        Advance_Metal_Purity_c,
        Created_Date_c,
        Total_Weight_c,
        Status_c,
        Delivery_Date_c
      FROM Order__c
      ${conditions}
    `;

    const orders = await pool.request().query(orderQuery);

    // 3️⃣ For each order, calculate Delivered and Balance weights
    const transactions = await Promise.all(
      orders.recordset.map(async (o) => {
        const deliveredResult = await pool.request()
          .input("partyCode", sql.NVarChar, o.Party_Code_c)
          .input("orderId", sql.NVarChar, o.OrderId)
          .query(`
            SELECT SUM(Total_Net_Weight_c) AS Delivered
            FROM Billing__c
            WHERE Party_Code_c = @partyCode AND Order_No_c = @orderId
          `);

        const delivered = deliveredResult.recordset[0]?.Delivered || 0;

        return {
          tranDate: o.Created_Date_c,
          party: o.Party_Code_c,
          orderId: o.OrderId,
          issuedWeight: o.Advance_Metal_c,
          deliveredWeight: delivered,
          balanceWeight: (o.Advance_Metal_c || 0) - (delivered || 0),
          advanceMetalPurity: o.Advance_Metal_Purity_c,
        };
      })
    );

    res.json(transactions);
  } catch (err) {
    console.error("Error fetching vendor transactions:", err);
    res.status(500).json({ error: err.message });
  }
});

// Overall process report

app.get("/api/process-report",checkMssqlConnection, async (req, res) => {
  try {
  
    const pool = req.mssql;

    const processes = [
      { name: "Casting", object: "Casting_dept__c",  fields: { issued: "Issud_weight_c", received: "Weight_Received_c", loss: "Casting_Loss_c", scrap: "Casting_Scrap_Weight_c", dust: "Casting_Dust_Weight_c" }},
      { name: "Pouch Creation", object: "Filing__c",  fields: { issued: "Issued_weight_c", received: "Receievd_weight_c", loss: "Filing_loss_c", scrap: "Filing_Scrap_Weight_c", dust: "Filing_Dust_Weight_c" }},
      { name: "Grinding", object: "Grinding__c",  fields: { issued: "Issued_Weight__c", received: "Received_Weight__c", loss: "Grinding_loss__c", scrap: "Grinding_Scrap_Weight__c", dust: "Grinding_Dust_Weight__c" }},
       { name: "Media", object: "Media__c",  fields: { issued: "Issued_Weight__c", received: "Received_Weight__c", loss: "Grinding_loss__c", scrap: "Grinding_Scrap_Weight__c", dust: "Grinding_Dust_Weight__c" }},
      { name: "Correction", object: "Correction__c",  fields: { issued: "Issued_Weight__c", received: "Received_Weight__c", loss: "Grinding_loss__c", scrap: "Grinding_Scrap_Weight__c", dust: "Grinding_Dust_Weight__c" }},
       { name: "Setting", object: "Setting__c",  fields: { issued: "Issued_Weight__c", received: "Returned_weight__c", loss: "Setting__c", scrap: "Setting_Scrap_Weight__c", dust: "Setting_Dust_Weight__c" }},
      { name: "Polishing", object: "Polishing__c",  fields: { issued: "Issued_Weight__c", received: "Received_Weight__c", loss: "Polishing_Loss__c", scrap: "Polishing_Scrap_Weight__c", dust: "Polishing_Dust_Weight__c" }},
      { name: "Dull", object: "Dull__c",fields: { issued: "Issued_Weight__c", received: "Returned_weight__c", loss: "Dull_loss__c", scrap: "Dull_Scrap_Weight__c", dust: "Dull_Dust_Weight__c" }},
      { name: "Plating", object: "Plating__c",  fields: { issued: "Issued_Weight__c", received: "Returned_Weight__c", loss: "Plating_loss__c", scrap: "Plating_Scrap_Weight__c", dust: "Plating_Dust_Weight__c" }},
      { name: "Cutting", object: "Cutting__c", fields: { issued: "Issued_Weight__c", received: "Returned_Weight__c", loss: "Cutting_loss__c", scrap: "Cutting_Scrap_Weight__c", dust: "Cutting_Dust_Weight__c" }}
    ];

    console.log(processes);

    let results = [];

    for (let p of processes) {
      const fieldList = Object.values(p.fields).filter(Boolean).join(", ");
      
      // Add date filter in SOQL
      const soql = `SELECT ${fieldList} FROM ${p.object}`;

      const queryRes = await pool.request().query(soql);

      let issued = 0, received = 0, loss = 0, scrap = 0, dust = 0,processWt=0;
    

//     queryRes.records.forEach(r => {


//       console.log(p.name+" - "+r[p.fields.received])

//   const issuedVal = parseFloat(r[p.fields.issued] || 0);
//   const receivedVal = parseFloat(r[p.fields.received] || 0);

//   issued += issuedVal;

//   // ✅ Check the actual received value
//   if (receivedVal == 0) {
//     processWt += issuedVal;
//   }
//   received += receivedVal;
// });

queryRes.recordset.forEach(r => {
  
      // console.log(p.name+" - "+r[p.fields.received])

  const issuedRaw = r[p.fields.issued];
const receivedRaw = r[p.fields.received];

const issuedVal = parseFloat(issuedRaw || 0);
const receivedVal = receivedRaw ? parseFloat(receivedRaw) : 0;

if (!receivedRaw || receivedVal === 0) {
  processWt += issuedVal;
}

  received += receivedVal;
});



results.push({
  process: p.name,
  issued_wt: issued,
  process_wt: processWt, // ✅ now has real value
  received_wt: received,
  // loss_wt: loss,
  // scrap_wt: scrap,
  // dust_wt: dust
});


    }

    res.json({ success: true, data: results });

console.log(results)

  } catch (err) {
    console.error("Error fetching process summary:", err);
    res.status(500).json({ success: false, message: "Error fetching process summary", error: err.message });
    
  }
});

// process summary 

app.get("/api/process-summary",checkMssqlConnection, async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;

    const pool = req.mssql;

    // Convert to Salesforce DateTime format
    const fromDateTime = `${fromDate}T00:00:00Z`;
    const toDateTime = `${toDate}T23:59:59Z`;

        const processes = [
      { name: "Casting", object: "Casting_dept__c",dateField: "Issued_Date_c",  fields: { issued: "Issud_weight_c", received: "Weight_Received_c", loss: "Casting_Loss_c", scrap: "Casting_Scrap_Weight_c", dust: "Casting_Dust_Weight_c" }},
      { name: "Pouch Creation", object: "Filing__c",dateField: "Issued_Date_c",  fields: { issued: "Issued_weight_c", received: "Receievd_weight_c", loss: "Filing_loss_c", scrap: "Filing_Scrap_Weight_c", dust: "Filing_Dust_Weight_c" }},
      { name: "Grinding", object: "Grinding__c",dateField: "Issued_Date__c",  fields: { issued: "Issued_Weight__c", received: "Received_Weight__c", loss: "Grinding_loss__c", scrap: "Grinding_Scrap_Weight__c", dust: "Grinding_Dust_Weight__c" }},
       { name: "Media", object: "Media__c", dateField: "Issued_Date__c", fields: { issued: "Issued_Weight__c", received: "Received_Weight__c", loss: "Grinding_loss__c", scrap: "Grinding_Scrap_Weight__c", dust: "Grinding_Dust_Weight__c" }},
      { name: "Correction", object: "Correction__c",dateField: "Issued_Date__c",  fields: { issued: "Issued_Weight__c", received: "Received_Weight__c", loss: "Grinding_loss__c", scrap: "Grinding_Scrap_Weight__c", dust: "Grinding_Dust_Weight__c" }},
       { name: "Setting", object: "Setting__c",dateField: "Issued_Date__c",  fields: { issued: "Issued_Weight__c", received: "Returned_weight__c", loss: "Setting__c", scrap: "Setting_Scrap_Weight__c", dust: "Setting_Dust_Weight__c" }},
      { name: "Polishing", object: "Polishing__c",dateField: "Issued_Date__c",  fields: { issued: "Issued_Weight__c", received: "Received_Weight__c", loss: "Polishing_Loss__c", scrap: "Polishing_Scrap_Weight__c", dust: "Polishing_Dust_Weight__c" }},
      { name: "Dull", object: "Dull__c",dateField: "Issued_Date__c",fields: { issued: "Issued_Weight__c", received: "Returned_weight__c", loss: "Dull_loss__c", scrap: "Dull_Scrap_Weight__c", dust: "Dull_Dust_Weight__c" }},
      { name: "Plating", object: "Plating__c",dateField: "Issued_Date__c",  fields: { issued: "Issued_Weight__c", received: "Returned_Weight__c", loss: "Plating_loss__c", scrap: "Plating_Scrap_Weight__c", dust: "Plating_Dust_Weight__c" }},
      { name: "Cutting", object: "Cutting__c",dateField: "Issued_Date__c", fields: { issued: "Issued_Weight__c", received: "Returned_Weight__c", loss: "Cutting_loss__c", scrap: "Cutting_Scrap_Weight__c", dust: "Cutting_Dust_Weight__c" }}
    ];

    // const processes = [
    //   { name: "Casting", object: "Casting_dept__c", dateField: "Issued_Date__c", fields: { issued: "Issud_weight__c", received: "Weight_Received__c", loss: "Casting_Loss__c", scrap: "Casting_Scrap_Weight__c", dust: "Casting_Dust_Weight__c" }},
    //   { name: "Pouch Creation", object: "Filing__c", dateField: "Issued_Date__c", fields: { issued: "Issued_weight__c", received: "Receievd_weight__c", loss: "Filing_loss__c", scrap: "Filing_Scrap_Weight__c", dust: "Filing_Dust_Weight__c" }},
    //   { name: "Grinding", object: "Grinding__c", dateField: "Issued_Date__c", fields: { issued: "Issued_Weight__c", received: "Received_Weight__c", loss: "Grinding_loss__c", scrap: "Grinding_Scrap_Weight__c", dust: "Grinding_Dust_Weight__c" }},
    //  { name: "Media", object: "Media__c", dateField: "Issued_Date__c", fields: { issued: "Issued_Weight__c", received: "Received_Weight__c", loss: "Grinding_loss__c", scrap: "Grinding_Scrap_Weight__c", dust: "Grinding_Dust_Weight__c" }},
    //  { name: "Correction", object: "Correction_c__c", dateField: "Issued_Date__c", fields: { issued: "Issued_Weight__c", received: "Received_Weight__c", loss: "Grinding_loss__c", scrap: "Grinding_Scrap_Weight__c", dust: "Grinding_Dust_Weight__c" }},
    //   { name: "Setting", object: "Setting__c", dateField: "Issued_Date__c", fields: { issued: "Issued_Weight__c", received: "Returned_weight__c", loss: "Setting_l__c", scrap: "Setting_Scrap_Weight__c", dust: "Setting_Dust_Weight__c" }},
    //   { name: "Polishing", object: "Polishing__c", dateField: "Issued_Date__c", fields: { issued: "Issued_Weight__c", received: "Received_Weight__c", loss: "Polishing_Loss__c", scrap: "Polishing_Scrap_Weight__c", dust: "Polishing_Dust_Weight__c" }},
    //   { name: "Dull", object: "Dull__c", dateField: "Issued_Date__c", fields: { issued: "Issued_Weight__c", received: "Returned_weight__c", loss: "Dull_loss__c", scrap: "Dull_Scrap_Weight__c", dust: "Dull_Dust_Weight__c" }},
    //   { name: "Plating", object: "Plating__c", dateField: "Issued_Date__c", fields: { issued: "Issued_Weight__c", received: "Returned_Weight__c", loss: "Plating_loss__c", scrap: "Plating_Scrap_Weight__c", dust: "Plating_Dust_Weight__c" }},
    //   { name: "Cutting", object: "Cutting__c", dateField: "Issued_Date__c", fields: { issued: "Issued_Weight__c", received: "Returned_Weight__c", loss: "Cutting_loss__c", scrap: "Cutting_Scrap_Weight__c", dust: "Cutting_Dust_Weight__c" }}
    // ];

    let results = [];

    for (let p of processes) {
      const fieldList = Object.values(p.fields).filter(Boolean).join(", ");
      
      // Add date filter in SOQL
    const soql = `
  SELECT ${fieldList}
  FROM ${p.object}
  WHERE ${p.dateField} BETWEEN @fromDate AND @toDate
`;

const queryRes = await pool
  .request()
  .input("fromDate", fromDateTime)
  .input("toDate", toDateTime)
  .query(soql);


      // const queryRes = await pool.request().query(soql);

      let issued = 0, received = 0, loss = 0, scrap = 0, dust = 0,processWt=0;
    
    queryRes.recordset.forEach(r => {
      
      console.log(p.name +" - "+r[p.fields.received]);

  const issuedVal = parseFloat(r[p.fields.issued] || 0);
  const receivedVal = parseFloat(r[p.fields.received] || 0);

  issued += issuedVal;

  // ✅ Check the actual received value
  if (receivedVal == 0) {
    processWt += issuedVal;
  }

  received += receivedVal;
  loss += parseFloat(r[p.fields.loss] || 0);
  scrap += parseFloat(p.fields.scrap ? r[p.fields.scrap] || 0 : 0);
  dust += parseFloat(r[p.fields.dust] || 0);
});

results.push({
  process: p.name,
  issued_wt: issued,
  process_wt: processWt, // ✅ now has real value
  received_wt: received,
  loss_wt: loss,
  scrap_wt: scrap,
  dust_wt: dust
});

    }

    res.json({ success: true, data: results });
  } catch (err) {
    console.error("Error fetching process summary:", err);
    res.status(500).json({ success: false, message: "Error fetching process summary", error: err.message });
  }
});

//#endregion      ============================================================


//#region     ==============    Order Submit    ==============================

app.post("/api/orders", checkMssqlConnection, async (req, res) => {
  try {
       // 1️⃣ Define base upload directory
    const baseUploadDir = path.join(process.cwd(), "Upload", "order");
    if (!fs.existsSync(baseUploadDir)) fs.mkdirSync(baseUploadDir, { recursive: true });

    // 2️⃣ Configure Multer storage (inside API)
    const storage = multer.diskStorage({
      destination: (req, file, cb) => cb(null, baseUploadDir),
      filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${file.originalname}`;
        cb(null, uniqueName);
      },
    });

    const upload = multer({ storage, limits: { fileSize: 1024 * 1024 * 1024 ,  fieldSize: 50 * 1024 * 1024      } }).single("pdfFile");

    // 3️⃣ Handle Multer upload manually
    upload(req, res, async (err) => {
      if (err) {
        console.error("❌ Multer upload error:", err);
        return res.status(500).json({ success: false, message: "File upload failed" });
      }

      try {
        // 3️⃣ Parse JSON safely
               const { file } = req;
               
  console.log("📦 Received file:", file?.originalname, "size:", file?.size);

        if (!req.body.orderData) {
          throw new Error("Missing orderData in request");
        }

        if(!file){
          console.log("missing pdf file")
        }

        const orderData = JSON.parse(req.body.orderData);
        const { partyCode, orderNo } = orderData.orderInfo;


        // Replace `/` or `\` with `-` to make a safe folder name
        const safeOrderNo = orderNo.replace(/[\/\\]/g, "-");

        // 4️⃣ Create a specific folder for this order (Upload/order/<safeOrderNo>)
        const orderDir = path.join(baseUploadDir, safeOrderNo);
        if (!fs.existsSync(orderDir)) fs.mkdirSync(orderDir, { recursive: true });

        console.log("✅ Received PDFs:", {
          hasFile: !!file,
          orderDir,
        });

    
        const finalPdfPath = path.join(orderDir, `${safeOrderNo}.pdf`);


        // If user uploaded a file (from Multer), move it into the order folder
         if (file && fs.existsSync(file.path)) {
          fs.renameSync(file.path, finalPdfPath);
          console.log("📄 Moved uploaded PDF to:", finalPdfPath);
        } else {
          console.warn("⚠️ No uploaded PDF found to move");
        }

        // 7️⃣ Create URLs for DB (for serving from server/public path)
        const pdfFileUrl = `/Upload/order/${safeOrderNo}/${safeOrderNo}.pdf`;

        // 9️⃣ Insert into SQL
        const pool = req.mssql;
        const result = await insertOrderToSQL(pool, orderData, pdfFileUrl);

        res.json({
          success: true,
          message: "Order and PDF saved successfully",
          data: result,
        });
      } catch (error) {
        console.error("Error during order save:", error);
        res.status(500).json({
          success: false,
          message: "Error saving order",
          error: error.message,
        });
      }
    });
  } catch (outerErr) {
    console.error("Unexpected error:", outerErr);
    res.status(500).json({
      success: false,
      message: "Unexpected server error",
      error: outerErr.message,
    });
  }
});

async function insertOrderToSQL(pool, orderData, pdfPath) {
  
  try {

    console.log("filename",pdfPath);

    console.log(orderData.orderInfo.partyCode);

    const {
      partyCode,
      partyName,
      orderNo,
      orderDate,
      category,
      purity,
      advanceMetal,
      advanceMetalPurity,
      priority,
      deliveryDate,
      remark,
      createdBy,
      status,
    } = orderData.orderInfo;

    const totalQuantity = orderData.totalQuantity;

    // 1. Insert into Orders__c
    await pool.request()
      .input("OrderNo", sql.NVarChar, orderNo)
      .input("OrderDate", sql.Date, orderDate)
      .input("PartyCode", sql.NVarChar, partyCode)
      .input("PartyName", sql.NVarChar, partyName)
      .input("Category", sql.NVarChar, category)
      .input("Purity", sql.NVarChar, purity)
      // .input("Advance_Metal__c", sql.Decimal(18, 2), advanceMetal)
      // .input("Advance_Metal_Purity__c", sql.Decimal(18, 2), advanceMetalPurity)
      .input("AdvanceMetal", sql.Decimal(18, 2), parseFloat(advanceMetal || "0"))
      .input("AdvanceMetalPurity", sql.Decimal(18, 2), parseFloat(advanceMetalPurity || "0"))

      .input("Priority", sql.NVarChar, priority)
      .input("DeliveryDate", sql.Date, deliveryDate)
      .input("Remark", sql.NVarChar, remark)
      .input("CreatedBy", sql.NVarChar, createdBy)
      .input("Status", sql.NVarChar, status)
      .input("TotalQuantity", sql.Int, totalQuantity)
      .input("Pdf", sql.NVarChar, pdfPath)
      .query(`
        INSERT INTO Order__c (
            Name, CreatedDate_c, Party_Code_c, Party_Ledger_c, Party_Name_c, Category_c,
            Purity_c, Advance_Metal_c, Advance_Metal_Purity_c, Priority_c,
            Delivery_Date_c, Remarks_c, Created_By_c, Status_c,
            Total_Quantity_c, Pdf_c,LastModifiedDate_c ,Created_Date_c,Order_Id_c, CreatedDate
        )
        VALUES (
          @OrderNo, @OrderDate, @PartyCode, @PartyCode, @PartyName, @Category,
          @Purity, @AdvanceMetal, @AdvanceMetalPurity, @Priority,
          @DeliveryDate, @Remark, @CreatedBy, @Status,
          @TotalQuantity, @Pdf,getdate(),getdate(),@OrderNo, getdate()
        )
      `);

    // 2. Insert into Order_Items__c (loop through items)
    for (const item of orderData.items) {
      await pool.request()
        .input("OrderNo", sql.NVarChar, orderNo)
        .input("Category", sql.NVarChar, item.category)
        .input("WeightRange", sql.NVarChar, item.weightRange)
        .input("Size", sql.NVarChar, item.size)
        // .input("Quantity__c", sql.Int, item.quantity)
        .input("Quantity", sql.Int, parseInt(item.quantity || "0", 10))
        .input("Remark", sql.NVarChar, item.remark)        
        .query(`
          INSERT INTO Order_Items__c (
            Order_No_c, Category_c, Weight_Range_c, Size_c, Quantity_c, Remark_c, CreatedDate
          )
          VALUES (
            @OrderNo, @Category, @WeightRange, @Size, @Quantity, @Remark, getdate()
          )
        `);
    }

    return { message: "Order and items inserted successfully" };

  } catch (error) {
    console.error("SQL Insert Error:", error);
    throw error;
  }
}

app.post("/api/orderItems", checkMssqlConnection, async (req, res) => {
  try {
    // 1️⃣ Define base upload directory
    const baseUploadDir = path.join(process.cwd(), "Upload", "order");
    if (!fs.existsSync(baseUploadDir)) fs.mkdirSync(baseUploadDir, { recursive: true });

    // 2️⃣ Configure Multer storage (inside API)
    const storage = multer.diskStorage({
      destination: (req, file, cb) => cb(null, baseUploadDir),
      filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${file.originalname}`;
        cb(null, uniqueName);
      },
    });

    const upload = multer({ storage, limits: { fileSize: 1024 * 1024 * 1024 ,  fieldSize: 50 * 1024 * 1024      } }).single("pdfFile");

    // 3️⃣ Handle Multer upload manually
    upload(req, res, async (err) => {
      if (err) {
        console.error("❌ Multer upload error:", err);
        return res.status(500).json({ success: false, message: "File upload failed" });
      }

      try {
        const { file } = req;

        
               
  console.log("📦 Received file:", file?.originalname, "size:", file?.size);

        const { data, imagesPdf, detailedPdf } = req.body;

        if (!data) {
          return res.status(400).json({ success: false, message: "Missing order data" });
        }

        if(!file){
          console.log("file missing");
        }

        const parsedData = JSON.parse(data);
        const orderNo = parsedData.orderNo;

        // Replace `/` or `\` with `-` to make a safe folder name
        const safeOrderNo = orderNo.replace(/[\/\\]/g, "-");

        // 4️⃣ Create a specific folder for this order (Upload/order/<safeOrderNo>)
        const orderDir = path.join(baseUploadDir, safeOrderNo);
        if (!fs.existsSync(orderDir)) fs.mkdirSync(orderDir, { recursive: true });

        console.log("✅ Received PDFs:", {
          hasFile: !!file,
          imagesPdfLength: imagesPdf?.length,
          detailedPdfLength: detailedPdf?.length,
          orderDir,
        });

        // 5️⃣ Define output paths (all inside order folder)
        const imagePdfPath = path.join(orderDir, `image_${safeOrderNo}.pdf`);
        const detailedPdfPath = path.join(orderDir, `detailed_${safeOrderNo}.pdf`);
        // const pdfFilePath = file ? path.join(orderDir, `${safeOrderNo}.pdf`) : null;
        const finalPdfPath = path.join(orderDir, `${safeOrderNo}.pdf`);

        // 6️⃣ Save base64 PDFs
        if (imagesPdf) fs.writeFileSync(imagePdfPath, Buffer.from(imagesPdf, "base64"));
        if (detailedPdf) fs.writeFileSync(detailedPdfPath, Buffer.from(detailedPdf, "base64"));

        // If user uploaded a file (from Multer), move it into the order folder
         if (file && fs.existsSync(file.path)) {
          fs.renameSync(file.path, finalPdfPath);
          console.log("📄 Moved uploaded PDF to:", finalPdfPath);
        } else {
          console.warn("⚠️ No uploaded PDF found to move");
        }

        // 7️⃣ Create URLs for DB (for serving from server/public path)
        const imagePdfUrl = `/Upload/order/${safeOrderNo}/image_${safeOrderNo}.pdf`;
        const detailedPdfUrl = `/Upload/order/${safeOrderNo}/detailed_${safeOrderNo}.pdf`;
        const pdfFileUrl = `/Upload/order/${safeOrderNo}/${safeOrderNo}.pdf`;

        const pool = req.mssql;

        // 8️⃣ Insert order and items into SQL
        const result = await insertOrderWithItems(pool, parsedData, imagePdfUrl, detailedPdfUrl, pdfFileUrl);

        // 9️⃣ Respond success
        res.json({
          success: true,
          message: "Order saved successfully",
          data: result,
        });
      } catch (error) {
        console.error("❌ Error processing order:", error);
        res.status(500).json({
          success: false,
          message: "Error saving order",
          error: error.message,
        });
      }
    });
  } catch (error) {
    console.error("❌ Outer error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
});

async function insertOrderWithItems(pool, orderData, imagePdfUrl,detailedPdfUrl, pdfFile) {
    try {

    console.log("filename",pdfFile);
    console.log(orderData.orderInfo);
    console.log(orderData.orderNo);
    console.log(orderData.items);
    console.log(imagePdfUrl);
    console.log(detailedPdfUrl);
    console.log(pdfFile);

    const totalQuantity = orderData.TotalQuantity;

    const {
      partyCode,
      partyName,
      orderNo,
      orderDate,
      category,
      purity,
      advanceMetal,
      advanceMetalPurity,
      priority,
      deliveryDate,
      remark,
      createdBy,
      status,
    } = orderData.orderInfo;

    // const totalQuantity = orderData.totalQuantity;

    // 1. Insert into Orders__c
    await pool.request()
      .input("OrderNo", sql.NVarChar, orderNo)
      .input("OrderDate", sql.Date, orderDate)
      .input("PartyCode", sql.NVarChar, partyCode)
      .input("PartyName", sql.NVarChar, partyName)
      .input("Category", sql.NVarChar, category)
      .input("Purity", sql.NVarChar, purity)
      // .input("Advance_Metal__c", sql.Decimal(18, 2), advanceMetal)
      // .input("Advance_Metal_Purity__c", sql.Decimal(18, 2), advanceMetalPurity)
      .input("AdvanceMetal", sql.Decimal(18, 2), parseFloat(advanceMetal || "0"))
      .input("AdvanceMetalPurity", sql.Decimal(18, 2), parseFloat(advanceMetalPurity || "0"))

      .input("Priority", sql.NVarChar, priority)
      .input("DeliveryDate", sql.Date, deliveryDate)
      .input("Remark", sql.NVarChar, remark)
      .input("CreatedBy", sql.NVarChar, createdBy)
      .input("Status", sql.NVarChar, status)
      .input("TotalQuantity", sql.Int, totalQuantity)
      .input("Pdf", sql.NVarChar, pdfFile)
      .query(`
        INSERT INTO Order__c (
            Name, CreatedDate_c, Party_Code_c, Party_Ledger_c, Party_Name_c, Category_c,
            Purity_c, Advance_Metal_c, Advance_Metal_Purity_c, Priority_c,
            Delivery_Date_c, Remarks_c, Created_By_c, Status_c,
            Total_Quantity_c, Pdf_c,LastModifiedDate_c ,Created_Date_c,Order_Id_c, CreatedDate
        )
        VALUES (
          @OrderNo, @OrderDate, @PartyCode, @PartyCode, @PartyName, @Category,
          @Purity, @AdvanceMetal, @AdvanceMetalPurity, @Priority,
          @DeliveryDate, @Remark, @CreatedBy, @Status,
          @TotalQuantity, @Pdf,getdate(),getdate(),@OrderNo, getdate()
        )
      `);

    // 2. Insert into Order_Items__c (loop through items)
    for (const item of orderData.items) {
      await pool.request()
        .input("OrderNo", sql.NVarChar, orderNo)
        .input("ModelName", sql.NVarChar, item.modelName)
        .input("Category", sql.NVarChar, item.category)
        .input("GrossWeight", sql.NVarChar, item.grossWeight)
        .input("Size", sql.NVarChar, item.size)
        .input("Quantity", sql.Int, item.quantity)
        .input("NetWeight", sql.Int, parseInt(item.netWeight || "0", 10))
        .input("StoneWeight", sql.Int, parseInt(item.stoneWeight || "0", 10))
        .input("Remark", sql.NVarChar, item.itemRemark)        
        .input("ImageUrl", imagePdfUrl)        
        .input("DetailedPdf", detailedPdfUrl)        
        .query(`
          INSERT INTO Order_Models__c (
            Order_c, Name, Name_c, Category_c, Quantity_c, size_c, Net_Weight_c, Stone_Weight_c, Gross_Weight_c, Remarks_c, Order_Image_sheet_c, Order_sheet_c, CreatedDate
          )
          VALUES (
            @OrderNo, @ModelName, @ModelName, @Category, @Quantity, @Size, @NetWeight, @StoneWeight, @GrossWeight, @Remark, @ImageUrl, @DetailedPdf, getdate()
          )
        `);
    }


    return { message: "Order and items inserted successfully" };

  } catch (error) {
    console.error("SQL Insert Error:", error);
    throw error;
  }
}

// order date get for table view  ================================================

app.get("/api/orders", checkMssqlConnection, async (req, res) => {
  try {
    const pool = req.mssql;

    const query = `
       SELECT Order_Id_c, Name, Party_Name_c, Delivery_Date_c, Advance_Metal_c, 
             Status_c, Pdf_c, Purity_c,	Remarks_c,	Created_By_c,	Created_Date_c,Category_c
      FROM Order__c
    `;

    const result = await pool.request().query(query);

    const orders = result.recordset.map(order => ({
      id: order.Order_Id_c,
      partyName: order.Party_Name_c,
      deliveryDate: order.Delivery_Date_c,
      advanceMetal: order.Advance_Metal_c,
      status: order.Status_c,
      category: order.Category_c,
     pdfUrl: order.Pdf__c,
      purity: order.Purity_c,
      remarks: order.Remarks_c,
      created_by: order.Created_By_c,
      created_date: order.Created_Date_c
    }));

    res.json({ success: true, data: orders });

  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).json({ success: false, error: "Failed to fetch orders from MSSQL" });
  }
});

app.get("/api/order-details", checkMssqlConnection, async (req, res) => {
  try {
     const pool = req.mssql;  

    const orderId = req.query.orderId;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "Order ID is required"
      });
    }

    // First, get the order details
    const orderQuery = `
      SELECT TOP 1 
        Id,
        Order_Id_c,
        Party_Name_c,
        Delivery_Date_c,
        Advance_Metal_c,
        Status_c,
        Purity_c,
        Remarks_c,
        Created_By_c,
        Created_Date_c,
        Pdf_c
      FROM Order__c
      WHERE Order_Id_c = '${orderId}'
    `;

    const orderResult =  await pool.request().query(orderQuery);

    if (!orderResult.recordset || orderResult.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    const orderDetails = orderResult.recordset[0];

    // Get regular models
    const modelsQuery = `
      SELECT Top 1 
        Id,
        Name,
        Category_c,
        Purity_c,
        Size_c,
        Color_c,
        Quantity_c,
        Gross_Weight_c,
        Stone_Weight_c,
        Net_Weight_c,
        Batch_No_c,
        Tree_No_c,
        Remarks_c,
        Order_sheet_c,
        Order_Image_sheet_c,
        Order_c
      FROM Order_Models__c
      WHERE Order_c = '${orderDetails.Order_Id_c} ' order by CreatedDate desc
    `;

    // Get canceled models
    // const canceledModelsQuery = `
    //   SELECT 
    //     Id,
    //     Name,
    //     Category_c,
    //     Purity_c,
    //     Size_c,
    //     Color_c,
    //     Quantity_c,
    //     Gross_Weight_c,
    //     Stone_Weight_c,
    //     Net_Weight_c,
    //     Batch_No_c,
    //     Tree_No_c,
    //     Remarks_c,
    //     Order_sheet_c,
    //     Order_Image_sheet_c,
    //     Order_c
    //   FROM Order_Models_Canceled
    //   WHERE Order__c = '${orderDetails.Id}'
    // `;

        const canceledModelsQuery = `
      SELECT * FROM Order_Models_Canceled
      WHERE Order_id = '${orderDetails.Id}'
    `;

    // Execute both queries in parallel
    const [modelsResult, canceledModelsResult] = await Promise.all([
      pool.request().query(modelsQuery),
      pool.request().query(canceledModelsQuery)
    ]);

    // Format the response
    const response = {
      orderDetails: {
        orderId: orderDetails.Order_Id_c,
        partyName: orderDetails.Party_Name_c,
        deliveryDate: orderDetails.Delivery_Date_c,
        advanceMetal: orderDetails.Advance_Metal_c,
        status: orderDetails.Status_c,
        purity: orderDetails.Purity_c,
        remarks: orderDetails.Remarks_c,
        createdBy: orderDetails.Created_By_c,
        createdDate: orderDetails.Created_Date_c,
        pdf: orderDetails.Pdf_c
      },
      regularModels: modelsResult.recordset.map(model => ({
        id: model.Id,
        name: model.Name,
        category: model.Category_c,
        purity: model.Purity_c,
        size: model.Size_c,
        color: model.Color_c,
        quantity: model.Quantity_c,
        grossWeight: model.Gross_Weight_c,
        stoneWeight: model.Stone_Weight_c,
        netWeight: model.Net_Weight_c,
        batchNo: model.Batch_No_c,
        treeNo: model.Tree_No_c,
        remarks: model.Remarks_c,
        orderSheet: model.Order_sheet_c,
        orderImageSheet: model.Order_Image_sheet_c
      })),
      canceledModels: canceledModelsResult.recordset.map(model => ({
        id: model.Id,
        name: model.Name,
        category: model.Category_c,
        purity: model.Purity_c,
        size: model.Size_c,
        color: model.Color_c,
        quantity: model.Quantity_c,
        grossWeight: model.Gross_Weight_c,
        stoneWeight: model.Stone_Weight_c,
        netWeight: model.Net_Weight_c,
        batchNo: model.Batch_No_c,
        treeNo: model.Tree_No_c,
        remarks: model.Remarks_c,
        orderSheet: model.Order_sheet_c,
        orderImageSheet: model.Order_Image_sheet_c,
      }))
    };

    res.json({
      success: true,
      data: response
    });

  } catch (error) {
    console.error("Error fetching order details:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch order details"
    });
  }
});

app.post("/api/update-order-status", checkMssqlConnection, async (req, res) => {
  const { orderId } = req.body;

  if (!orderId) {
    return res.status(400).json({
      success: false,
      message: "Order ID is required"
    });
  }

  try {
    const pool = req.mssql;

    // Step 1: Check if order exists
    const checkResult = await pool
      .request()
      .input("orderId", sql.NVarChar, orderId)
      .query("SELECT Order_Id_c FROM Order__c WHERE Order_Id_c = @orderId");

    if (checkResult.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Order with ID ${orderId} not found`
      });
    }

    // Step 2: Update the order status
    await pool
      .request()
      .input("orderId", sql.NVarChar, orderId)
      .input("status", sql.NVarChar, "Finished")
      .query("UPDATE Order__c SET Status_c = @status WHERE Order_Id_c = @orderId");

    res.json({
      success: true,
      message: "Order status updated successfully",
      data: {
        orderId,
        status: "Finished"
      }
    });

  } catch (error) {
    console.error("MSSQL error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update order status",
      error: error.message
    });
  }
});

// app.post("/api/update-model",checkMssqlConnection, async (req, res) => {
//   try {
//     const { orderId, models, detailedPdf, imagesPdf } = req.body;

//     if (!orderId || !models || !Array.isArray(models) || models.length === 0) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid request data",
//       });
//     } 

//     console.log(orderId);
//     const pool = req.mssql;

//     const regularModels = models.filter((model) => !model.isCanceled);
//     const canceledModels = models.filter((model) => model.isCanceled);

//     let regularResponses = [];
//     let canceledResponses = [];

//     // 1. Validate Order exists
//     const orderResult = await pool
//       .request()
//       .input("orderId",  orderId)
//       .query(" SELECT Order_Id_c FROM Order__c WHERE Order_Id_c =  @orderId");

//     if (!orderResult.recordset.length) {
//       return res.status(404).json({
//         success: false,
//         message: `Order not found with Order ID: ${orderId}`,
//       });
//     }

//     const dbOrderId = orderResult.recordset[0].Order_Id_c;


//     // 2. Insert Regular Models
//     if (regularModels.length > 0) {
//       for (const model of regularModels) {
//         const result = await pool
//           .request()
//           .input("name", sql.NVarChar, model.item)
//           .input("category", sql.NVarChar, model.category)
//           .input("purity", sql.NVarChar, model.purity)
//           .input("size", sql.NVarChar, model.size)
//           .input("color", sql.NVarChar, model.color)
//           .input("quantity", sql.Decimal(18, 2), model.quantity || 0)
//           .input("grossWeight", sql.Decimal(18, 3), model.grossWeight || 0)
//           .input("stoneWeight", sql.Decimal(18, 3), model.stoneWeight || 0)
//           .input("netWeight", sql.Decimal(18, 3), model.netWeight || 0)
//           .input("remarks", sql.NVarChar, model.remarks)
//           .input("orderId", sql.NVarChar, dbOrderId)
//           .input("detailedPDF", detailedPdf)
//           .input("imagePDF", imagesPdf)
//           .query(


//             `INSERT INTO Order_Models__c (Name, Category_c, Purity_c, size_c, Color_c, Quantity_c, Gross_Weight_c, Stone_Weight_c, Net_Weight_c, Remarks_c, Order_c, Order_sheet_c, Order_Image_sheet_c, createdDate, created_Date_c)
//              OUTPUT INSERTED.Id
//              VALUES (@name, @category, @purity, @size, @color, @quantity, @grossWeight, @stoneWeight, @netWeight, @remarks, @orderId, @detailedPDF, @imagePDF, getdate(), getdate() )`
//           );
//         regularResponses.push(result.recordset[0]);
//       }
//     }

//     // 3. Insert Canceled Models
//     if (canceledModels.length > 0) {
//       for (const model of canceledModels) {
//         const result = await pool
//           .request()
//           .input("name", sql.NVarChar, model.item)
//           .input("category", sql.NVarChar, model.category)
//           .input("purity", sql.NVarChar, model.purity)
//           .input("size", sql.NVarChar, model.size)
//           .input("color", sql.NVarChar, model.color)
//           .input("quantity", sql.Decimal(18, 2), model.quantity || 0)
//           .input("grossWeight", sql.Decimal(18, 3), model.grossWeight || 0)
//           .input("stoneWeight", sql.Decimal(18, 3), model.stoneWeight || 0)
//           .input("netWeight", sql.Decimal(18, 3), model.netWeight || 0)
//           .input("remarks", sql.NVarChar, model.remarks)
//           .input("orderId", sql.Int, dbOrderId)
//           .query(
//             `INSERT INTO Order_Models_Canceled (Name, Category, Purity, Size, Color, Quantity, Gross_Weight, Stone_Weight, Net_Weight, Remarks, Order_Id)
//              OUTPUT INSERTED.Id
//              VALUES (@name, @category, @purity, @size, @color, @quantity, @grossWeight, @stoneWeight, @netWeight, @remarks, @orderId)`
//           );
//         canceledResponses.push(result.recordset[0]);
//       }
//     }

//     // NOTE: Handling PDF uploads and ContentVersion logic is Salesforce-specific.
//     // For SQL, you'd store PDFs as binary in a separate table or file system.

//     res.json({
//       success: true,
//       message: "Models processed successfully",
//       data: {
//         regularModels: regularResponses,
//         canceledModels: canceledResponses,
//       },
//     });

//     console.log("Models processed successfully");
//     console.log(res.json);
//   } catch (error) {
//     console.error("Error in update-model endpoint:", error);
//     res.status(500).json({
//       success: false,
//       message: error.message || "Failed to process models",
//     });
//   }
// });

app.post("/api/update-model", checkMssqlConnection, async (req, res) => {
  try {
    const { orderId, models, detailedPdf, imagesPdf } = req.body;

    if (!orderId || !models || !Array.isArray(models) || models.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid request data",
      });
    }

    const pool = req.mssql;

    // 1️⃣ Check Order exists
    const orderResult = await pool
      .request()
      .input("orderId", sql.NVarChar, orderId)
      .query("SELECT Order_Id_c FROM Order__c WHERE Order_Id_c = @orderId");

    if (!orderResult.recordset.length) {
      return res.status(404).json({
        success: false,
        message: `Order not found with Order ID: ${orderId}`,
      });
    }

    const dbOrderId = orderResult.recordset[0].Order_Id_c;

    // 🧩 Replace slash for folder/file safe name
    const safeOrderId = dbOrderId.replace(/\//g, "-");

    // 2️⃣ Create folder if not exists
    const baseDir = path.join(process.cwd(), "Upload", "Order", safeOrderId);
    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true });
      console.log(`📁 Created folder: ${baseDir}`);
    }

    // 3️⃣ Save PDFs to local folder
    const detailedPdfPath = path.join(baseDir, `detailed_${safeOrderId}.pdf`);
    const imagesPdfPath = path.join(baseDir, `image_${safeOrderId}.pdf`);

    // Decode and write files
      if (detailedPdf) {
        fs.writeFileSync(detailedPdfPath, Buffer.from(detailedPdf, "base64"));
        console.log(`✅ Saved detailed PDF at ${detailedPdfPath}`);
      }

      if (imagesPdf) {
        fs.writeFileSync(imagesPdfPath, Buffer.from(imagesPdf, "base64"));
        console.log(`✅ Saved images PDF at ${imagesPdfPath}`);
      }

      // ✅ Generate relative paths for DB
const relativeDetailedPath = path.join(
  "\\Upload",
  "Order",
  safeOrderId,
  `detailed_${safeOrderId}.pdf`
);

const relativeImagesPath = path.join(
  "\\Upload",
  "Order",
  safeOrderId,
  `image_${safeOrderId}.pdf`
);

    // 4️⃣ Insert models into SQL
    const regularModels = models.filter((m) => !m.isCanceled);
    const canceledModels = models.filter((m) => m.isCanceled);
    let regularResponses = [];
    let canceledResponses = [];

    for (const model of regularModels) {
      const result = await pool
        .request()
        .input("name", sql.NVarChar, model.item)
        .input("category", sql.NVarChar, model.category)
        .input("purity", sql.NVarChar, model.purity)
        .input("size", sql.NVarChar, model.size)
        .input("color", sql.NVarChar, model.color)
        .input("quantity", sql.Decimal(18, 2), model.quantity || 0)
        .input("grossWeight", sql.Decimal(18, 3), model.grossWeight || 0)
        .input("stoneWeight", sql.Decimal(18, 3), model.stoneWeight || 0)
        .input("netWeight", sql.Decimal(18, 3), model.netWeight || 0)
        .input("remarks", sql.NVarChar, model.remarks)
        .input("orderId", sql.NVarChar, dbOrderId)
        .input("detailedPDFPath", sql.NVarChar, relativeDetailedPath)
        .input("imagePDFPath", sql.NVarChar, relativeImagesPath)
        .query(`
          INSERT INTO Order_Models__c 
          (Name, Category_c, Purity_c, size_c, Color_c, Quantity_c, Gross_Weight_c,
           Stone_Weight_c, Net_Weight_c, Remarks_c, Order_c, 
           Order_sheet_c, Order_Image_sheet_c, createdDate, created_Date_c)
          OUTPUT INSERTED.Id
          VALUES 
          (@name, @category, @purity, @size, @color, @quantity, @grossWeight,
           @stoneWeight, @netWeight, @remarks, @orderId, 
           @detailedPDFPath, @imagePDFPath, GETDATE(), GETDATE());
        `);
      regularResponses.push(result.recordset[0]);
    }

    // 5️⃣ Insert canceled models
    for (const model of canceledModels) {
      const result = await pool
        .request()
        .input("name", sql.NVarChar, model.item)
        .input("category", sql.NVarChar, model.category)
        .input("purity", sql.NVarChar, model.purity)
        .input("size", sql.NVarChar, model.size)
        .input("color", sql.NVarChar, model.color)
        .input("quantity", sql.Decimal(18, 2), model.quantity || 0)
        .input("grossWeight", sql.Decimal(18, 3), model.grossWeight || 0)
        .input("stoneWeight", sql.Decimal(18, 3), model.stoneWeight || 0)
        .input("netWeight", sql.Decimal(18, 3), model.netWeight || 0)
        .input("remarks", sql.NVarChar, model.remarks)
        .input("orderId", sql.NVarChar, dbOrderId)
        .query(`
          INSERT INTO Order_Models_Canceled 
          (Name, Category, Purity, Size, Color, Quantity, Gross_Weight, Stone_Weight,
           Net_Weight, Remarks, Order_Id)
          OUTPUT INSERTED.Id
          VALUES 
          (@name, @category, @purity, @size, @color, @quantity, @grossWeight, 
           @stoneWeight, @netWeight, @remarks, @orderId);
        `);
      canceledResponses.push(result.recordset[0]);
    }

    // 6️⃣ Send success response
    res.json({
      success: true,
      message: "Models processed successfully",
      data: {
        regularModels: regularResponses,
        canceledModels: canceledResponses,
        pdfPaths: {
          detailed: detailedPdfPath,
          images: imagesPdfPath,
        },
      },
    });

    console.log("✅ Models processed successfully");
  } catch (error) {
    console.error("❌ Error in update-model endpoint:", error);
    res.status(500).json({
      success: false,
      message: "Failed to process models",
      error: error.message,
    });
  }
});

//#endregion      ============================================================

//#region   =========   Tagging   ============================================

/* ----------------- Get All Tagging Details -----------------  */
app.get("/api/tagging",checkMssqlConnection, async (req, res) => {
  try {
    console.log('\n=== FETCHING ALL TAGGING DETAILS ===');
const pool = req.mssql;
    // Get all Tagging records
    const taggingQuery = await pool.request().query(
      `SELECT 
        Id,
        Name,
        Party_Name_c,
        Total_Gross_Weight_c,
        Total_Net_Weight_c,
        Total_Stone_Weight_c,
        Total_Stone_Charges_c,
        Pdf_c,
        Excel_sheet_c,
        Created_Date_c
       FROM Tagging__c 
       ORDER BY Created_Date_c DESC`
    );

    if (!taggingQuery.recordset || taggingQuery.recordset.length === 0) {
      return res.json({
        success: true,
        data: []
      });
    }

    // Map the records to the desired format
    const taggings = taggingQuery.recordset.map(record => ({
      id: record.Id,
      taggingId: record.Name,
      partyCode: record.Party_Name_c,
      totalGrossWeight: record.Total_Gross_Weight_c,
      totalNetWeight: record.Total_Net_Weight_c,
      totalStoneWeight: record.Total_Stone_Weight_c,
      totalStoneCharges: record.Total_Stone_Charges_c,
      pdfUrl: record.Pdf_c,
      excelUrl: record.Excel_sheet_c,
      createdDate: record.Created_Date_c
    }));

    console.log(`Found ${taggings.length} tagging records`);

    res.json({
      success: true,
      data: taggings
    });

  } catch (error) {
    console.error('\n=== ERROR DETAILS ===');
    console.error('Error:', error);
    console.error('Stack:', error.stack);
    res.status(500).json({
      success: false,
      message: "Failed to fetch tagging details",
      error: error.message
    });
  }
});

/*  ---------------- Get Orders By Party For Tagging -----------------  */
app.get("/api/taggingorders",checkMssqlConnection, async (req, res) => {
  try {
    const pool = req.mssql;
    const { partyCode } = req.query;
    console.log('[Get Orders] Fetching orders for party:', partyCode);

    const query = `
      SELECT Order_Id_c
      FROM Order__c 
      WHERE Party_Code_c = '${partyCode}'
      ORDER BY CreatedDate DESC`;

    const result = await pool.request().query(query);
    
    res.json({
      success: true,
      data: result.recordset.map(order => order.Order_Id_c)
    });

  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch orders"
    });
  }
});

/*  ----------------- Get Model Names By Order ID For Tagging -----------------  */
app.get("/api/tagging-order-models",checkMssqlConnection, async (req, res) => {
  try {
     const pool = req.mssql;
    const { orderId } = req.query;
    console.log('[Get Order Models] Fetching models for order:', orderId);

    // First get the Order record to get its Salesforce ID
    const orderQuery = await pool.request().query(
      `SELECT Order_Id_c FROM Order__c WHERE Order_Id_c = '${orderId}'`
    );

    if (!orderQuery.recordset || orderQuery.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    // Get just the model names
    const modelsQuery = await pool.request().query(
      `SELECT Name 
       FROM Order_Models__c 
       WHERE Order_c = '${orderQuery.recordset[0].Order_Id_c}'`
    );

    res.json({
      success: true,
      data: modelsQuery.recordset.map(model => model.Name)
    });

  } catch (error) {
    console.error("Error fetching order models:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch order models"
    });
  }
});

/*  ----------------- Get Model Image -----------------  */

app.get("/api/model-image",checkMssqlConnection, async (req, res) => {
  try {
     const pool = req.mssql;
    const { modelCode } = req.query;
    console.log('[Get Model Image] Starting request for model:', modelCode);

   

    // Query Salesforce for the model record
    const query = `SELECT Image_URL_c FROM Jewlery_Model__c WHERE Name = '${modelCode}'`;
    const modelQuery = await pool.request().query(query);

    if (!modelQuery?.recordset || modelQuery.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: `No records found for model: ${modelCode}`
      });
    }

    const imageUrl = modelQuery.recordset[0].Image_URL_c;
    if (!imageUrl) {
      return res.status(404).json({
        success: false,
        message: `No image URL for model: ${modelCode}`
      });
    }

    // Return URL that points to our download endpoint
    // const downloadUrl = `/api/download-file?url=${encodeURIComponent(imageUrl)}`;

    res.json({
      success: true,
      data: imageUrl
    });

  } catch (error) {
    console.error('[Get Model Image] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch model image URL'
    });
  }
});


/**----------------- Create Tagged Item ----------------- */

app.post("/api/create-tagged-item", checkMssqlConnection, upload.single('pdf'), async (req, res) => {
  try {
    let pdfUrl = null;
    
  const pool = req.mssql;
        // Access FormData values
      const {
        taggingId,
        modelDetails,
        modelUniqueNumber,
        grossWeight,
        netWeight,
        stoneWeight,
        stoneCharge,
      } = req.body;
   

 if (req.file) {
        // Example: /uploads/tagged/12345-model.pdf
        pdfUrl = `/uploads/tagged/${req.file.filename}`;
      }

          // ✅ Insert into your SQL table (replace YOUR_TABLE_NAME with actual)
      const insertQuery = `
        INSERT INTO Tagged_item__c
          (Name, Model_Details_c, Model_Unique_Number_c, Gross_Weight_c, Net_Weight_c, Stone_Weight_c, Stone_Charge_c)
        VALUES 
          (@name, @modelDetails, @modelUniqueNumber, @grossWeight, @netWeight, @stoneWeight, @stoneCharge);

        SELECT SCOPE_IDENTITY() AS id; -- return inserted ID
      `;

      
      const result = await pool.request()
        .input("name", sql.NVarChar, taggingId)
        .input("modelDetails", sql.NVarChar, modelDetails)
        .input("modelUniqueNumber", sql.NVarChar, modelUniqueNumber)
        .input("grossWeight", sql.Decimal(18, 3), grossWeight)
        .input("netWeight", sql.Decimal(18, 3), netWeight)
        .input("stoneWeight", sql.Decimal(18, 3), stoneWeight)
        .input("stoneCharge", sql.Decimal(18, 2), stoneCharge)
        .input("pdfUrl", sql.NVarChar, pdfUrl)
        .query(insertQuery);


      const newId = result.recordset[0]?.id || null;
    res.json({
        success: true,
        data: {
          id: newId,
          taggingId,
          modelDetails,
          modelUniqueNumber,
          grossWeight,
          netWeight,
          stoneWeight,
          stoneCharge,
          pdfUrl,
        },
      });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      message: "Failed to create tagged item",
      error: error.message
    });
  }
});

// tag submitting     ========================================================

// app.post("/api/submit-tagging", checkMssqlConnection, upload.fields([
//   { name: 'pdfFile', maxCount: 1 },
//   { name: 'excelFile', maxCount: 1 }
// ]), async (req, res) => {



//   const baseUploadDir = path.join(__dirname, "Upload","Tag");

// // Configure Multer Storage (temporary)
// const storage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     cb(null, baseUploadDir);
//   },
//   filename: (req, file, cb) => {
//     cb(null, Date.now() + "-" + file.originalname);
//   }
// });

// const upload = multer({ storage: storage });



//   try {


//     const pool = req.mssql;

//     console.log('\n=== SUBMIT TAGGING REQUEST STARTED ===');
    
//     // Initialize URLs
//     let pdfUrl = null;
//     let excelUrl = null;

//     // 1. Extract all data from request
//     const { 
//       taggingId, 
//       partyCode, 
//       totalGrossWeight,
//       totalNetWeight,
//       totalStoneWeight,
//       totalStoneCharges
//     } = req.body;

//     console.log('Request Data:', { 
//       taggingId, 
//       partyCode, 
//       totalGrossWeight,
//       totalNetWeight,
//       totalStoneWeight,
//       totalStoneCharges
//     });

//      // ✅ Step 1: Create Tagging folder if not exists
//       const taggingFolder = path.join(baseUploadDir, taggingId);
//       if (!fs.existsSync(taggingFolder)) {
//         fs.mkdirSync(taggingFolder, { recursive: true });
//         console.log("Created folder:", taggingFolder);
//       }

//       // ✅ Step 2: Save PDF
//       if (req.files && req.files.pdfFile && req.files.pdfFile[0]) {
//         const pdfFile = req.files.pdfFile[0];
//         const pdfDestPath = path.join(taggingFolder, `${taggingId}.pdf`);
//         fs.renameSync(pdfFile.path, pdfDestPath);
//         pdfUrl = `/Upload/${taggingId}/${taggingId}.pdf`;
//         console.log("PDF saved:", pdfUrl);
//       }

//       // ✅ Step 3: Save Excel
//       if (req.files && req.files.excelFile && req.files.excelFile[0]) {
//         const excelFile = req.files.excelFile[0];
//         const excelDestPath = path.join(taggingFolder, `${taggingId}.xls`);
//         fs.renameSync(excelFile.path, excelDestPath);
//         excelUrl = `/Upload/${taggingId}/${taggingId}.xls`;
//         console.log("Excel saved:", excelUrl);
//       }


//         const insertQuery = `
//         INSERT INTO Tagging__c
//           (Name, Party_Name_c, Total_Gross_Weight_c, Total_Net_Weight_c, Total_Stone_Weight_c, Total_Stone_Charges_c, Pdf_c, Excel_sheet_c, Created_Date_c)
//         VALUES 
//           (@name, @partycode, @grsWt, @netWt, @stoneWt, @stoneCharge, @pdfUrl, @excelUrl, getdate());

//         SELECT SCOPE_IDENTITY() AS id; -- return inserted ID
//       `;

      
//       const result = await pool.request()
//         .input("name", sql.NVarChar, taggingId)
//         .input("partycode", sql.NVarChar, partyCode)
//         .input("grsWt", sql.Decimal(18, 3), totalGrossWeight)
//         .input("netWt", sql.Decimal(18, 3), totalNetWeight)
//         .input("stoneWt", sql.Decimal(18, 3), totalStoneWeight)
//         .input("stoneCharge", sql.Decimal(18, 3), totalStoneCharges)
//         .input("pdfUrl", sql.NVarChar, pdfUrl)
//         .input("excelUrl", sql.NVarChar, excelUrl)
//         .query(insertQuery);


//       const newId = result.recordset[0]?.id || null;
//     res.json({
//         success: true,
//         data: {
//           id: newId,
//           taggingId,
//           partyCode,
//           totalGrossWeight,
//           totalNetWeight,
//           totalStoneWeight,
//           totalStoneCharges,
//           pdfUrl,
//           excelUrl,
//         },
//       });


//     console.log('Tagging record created:', newId);

//       const updateQuery = `
//       update Tagged_item__c set Tagging_c = @taggingResultId where name = @taggingId
//       `;

      
//       const updateResult = await pool.request()
//         .input("taggingId", sql.NVarChar, taggingId)
//         .input("taggingResultId", sql.NVarChar, newId)
//         .query(updateQuery);


//     console.log('Updated Tagged Items:', updateResult);

//     // 6. Send Response with all weights
//     res.json({
//       success: true,
//       data: {
//         id: taggingRecord.id,
//         taggingId: taggingId,
//         partyCode: partyCode,
//         totalGrossWeight: totalGrossWeight,
//         totalNetWeight: totalNetWeight,
//         totalStoneWeight: totalStoneWeight,
//         totalStoneCharges: totalStoneCharges,
//         pdfUrl: pdfUrl,
//         excelUrl: excelUrl,
//         updatedItems: updateResult.length
//       }
//     });

//   } catch (error) {
//     console.error('\n=== ERROR DETAILS ===');
//     console.error('Error:', error);
//     console.error('Stack:', error.stack);
//     res.status(500).json({
//       success: false,
//       message: "Failed to submit tagging",
//       error: error.message,
//       details: {
//         files: req.files ? Object.keys(req.files) : [],
//         body: req.body
//       }
//     });
//   }
// });


app.post("/api/submit-tagging", checkMssqlConnection, async (req, res) => {
  try {
    console.log("\n=== SUBMIT TAGGING REQUEST STARTED ===");

    // ✅ Step 1: Setup a temporary multer storage (inside the route)
    const tempDir = path.join(__dirname, "temp");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
      console.log("Created temp folder:", tempDir);
    }

    const storage = multer.diskStorage({
      destination: (req, file, cb) => cb(null, tempDir),
      filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
    });

    const upload = multer({ storage }).fields([
      { name: "pdfFile", maxCount: 1 },
      { name: "excelFile", maxCount: 1 },
    ]);

    // ✅ Step 2: Wrap multer upload in a promise
    await new Promise((resolve, reject) => {
      upload(req, res, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // ✅ Step 3: Extract form data
    const {
      taggingId,
      partyCode,
      totalGrossWeight,
      totalNetWeight,
      totalStoneWeight,
      totalStoneCharges,
    } = req.body;

    console.log("Request Data:", {
      taggingId,
      partyCode,
      totalGrossWeight,
      totalNetWeight,
      totalStoneWeight,
      totalStoneCharges,
    });

    // ✅ Step 4: Create destination folder (/Upload/tag/<taggingId>/)
    const uploadBase = path.join(__dirname, "Upload", "tag");
    const taggingFolder = path.join(uploadBase, taggingId);
    if (!fs.existsSync(taggingFolder)) {
      fs.mkdirSync(taggingFolder, { recursive: true });
      console.log("Created tagging folder:", taggingFolder);
    }

    // ✅ Step 5: Move uploaded files
    let pdfUrl = null;
    let excelUrl = null;

    // Move PDF
    if (req.files?.pdfFile?.[0]) {
      const pdfFile = req.files.pdfFile[0];
      const pdfDestPath = path.join(taggingFolder, `${taggingId}.pdf`);
      fs.renameSync(pdfFile.path, pdfDestPath);
      pdfUrl = `/Upload/tag/${taggingId}/${taggingId}.pdf`;
      console.log("PDF saved at:", pdfUrl);
    }

    // Move Excel
    if (req.files?.excelFile?.[0]) {
      const excelFile = req.files.excelFile[0];
      const excelDestPath = path.join(taggingFolder, `${taggingId}.xls`);
      fs.renameSync(excelFile.path, excelDestPath);
      excelUrl = `/Upload/tag/${taggingId}/${taggingId}.xls`;
      console.log("Excel saved at:", excelUrl);
    }

    // ✅ Step 6: Save to SQL
    const pool = req.mssql;
    const insertQuery = `
      INSERT INTO Tagging__c
        (Name, Party_Name_c, Total_Gross_Weight_c, Total_Net_Weight_c, Total_Stone_Weight_c, Total_Stone_Charges_c, Pdf_c, Excel_sheet_c, Created_Date_c)
      VALUES 
        (@name, @partycode, @grsWt, @netWt, @stoneWt, @stoneCharge, @pdfUrl, @excelUrl, getdate());
      SELECT SCOPE_IDENTITY() AS id;
    `;

    const result = await pool
      .request()
      .input("name", sql.NVarChar, taggingId)
      .input("partycode", sql.NVarChar, partyCode)
      .input("grsWt", sql.Decimal(18, 3), totalGrossWeight)
      .input("netWt", sql.Decimal(18, 3), totalNetWeight)
      .input("stoneWt", sql.Decimal(18, 3), totalStoneWeight)
      .input("stoneCharge", sql.Decimal(18, 3), totalStoneCharges)
      .input("pdfUrl", sql.NVarChar, pdfUrl)
      .input("excelUrl", sql.NVarChar, excelUrl)
      .query(insertQuery);

    const newId = result.recordset[0]?.id || null;

    // ✅ Step 7: Update linked items
    await pool
      .request()
      .input("taggingId", sql.NVarChar, taggingId)
      .input("taggingResultId", sql.NVarChar, taggingId)
      .query(`UPDATE Tagged_item__c SET Tagging_c = @taggingResultId WHERE Name = @taggingId`);

    console.log("Record inserted and linked successfully");

    // ✅ Step 8: Send success response
    res.json({
      success: true,
      data: {
        id: newId,
        taggingId,
        partyCode,
        pdfUrl,
        excelUrl,
      },
    });
  } catch (error) {
    console.error("\n=== ERROR DETAILS ===");
    console.error("Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to submit tagging",
      error: error.message,
    });
  }
});

app.get("/api/tagging-details/:taggingId",checkMssqlConnection, async (req, res) => {
  try {
    
    const pool = req.mssql;

    const { taggingId } = req.params;
    console.log('\n=== FETCHING TAGGING DETAILS ===');
    console.log('Tagging ID:', taggingId);

    // 1. Get Tagging record
    const taggingQuery = await pool.request().query(
      `SELECT 
        Id,
        Name,
        Party_Name_c,
        Total_Gross_Weight_c,
        Total_Net_Weight_c,
        Total_Stone_Weight_c,
        Total_Stone_Charges_c,
        Pdf_c,
        Excel_sheet_c,
        Created_Date_c
       FROM Tagging__c 
       WHERE Name = '${taggingId}'`
    );

    if (!taggingQuery.recordset || taggingQuery.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Tagging record not found"
      });
    }

    // 2. Get Tagged Items
    const taggedItemsQuery = await pool.request().query(
      `SELECT 
        Id,
        Name,
        model_details_c,
        Model_Unique_Number_c,
        Gross_Weight_c,
        Net_Weight_c,
        Stone_Weight_c,
        Stone_Charge_c
       FROM Tagged_item__c 
       WHERE Tagging_c = '${taggingQuery.recordset[0].Name}'`
    );

    // 3. Prepare response
    const response = {
      success: true,
      data: {
        tagging: {
          id: taggingQuery.recordset[0].Id,
          taggingId: taggingQuery.recordset[0].Name,
          partyCode: taggingQuery.recordset[0].Party_Name_c,
          totalGrossWeight: taggingQuery.recordset[0].Total_Gross_Weight_c,
          totalNetWeight: taggingQuery.recordset[0].Total_Net_Weight_c,
          totalStoneWeight: taggingQuery.recordset[0].Total_Stone_Weight_c,
          totalStoneCharges: taggingQuery.recordset[0].Total_Stone_Charges_c,
          pdfUrl: taggingQuery.recordset[0].Pdf_c,
          excelUrl: taggingQuery.recordset[0].Excel_sheet_c,
          createdDate: taggingQuery.recordset[0].Created_Date_c
        },
        taggedItems: taggedItemsQuery.recordset.map(item => ({
          id: item.Id,
          name: item.Name,
          modelUniqueNumber: item.Model_Unique_Number_c,
          grossWeight: item.Gross_Weight_c,
          netWeight: item.Net_Weight_c,
          stoneWeight: item.Stone_Weight_c,
          stoneCharge: item.Stone_Charge_c,
          pdfUrl: item.model_details_c
        })),
        summary: {
          totalItems: taggedItemsQuery.recordset.length,
          totalGrossWeight: taggedItemsQuery.recordset.reduce((sum, item) => 
            sum + (item.Gross_Weight_c || 0), 0
          ),
          totalNetWeight: taggedItemsQuery.recordset.reduce((sum, item) => 
            sum + (item.Net_Weight_c || 0), 0
          ),
          totalStoneWeight: taggedItemsQuery.recordset.reduce((sum, item) => 
            sum + (item.Stone_Weight_c || 0), 0
          )
        }
      }
    };

    console.log('Sending response with:', {
      taggingFound: true,
      itemsCount: taggedItemsQuery.recordset.length,
      hasPDF: !!taggingQuery.recordset[0].Pdf_c,
      hasExcel: !!taggingQuery.recordset[0].Excel_sheet_c
    });

    res.json(response);

  } catch (error) {
    console.error('\n=== ERROR DETAILS ===');
    console.error('Error:', error);
    console.error('Stack:', error.stack);
    res.status(500).json({
      success: false,
      message: "Failed to fetch tagging details",
      error: error.message
    });
  }
});

//#endregion    ==============================================================

// ===================================    CASTING     ====================================================

/**--------------------------Casting Management---------- **/

app.post("/api/casting", async (req, res) => {
  try {
    const {
      castingNumber,
      date,
      orders,
      waxTreeWeight,
      purity,
      calculatedWeight,
      purityPercentages,
      requiredMetals,
      issuedItems,
      totalIssued
    } = req.body;

    if (!castingNumber || !date || !orders || orders.length === 0) {
      return res.status(400).json({ success: false, message: "Required fields are missing" });
    }

    let formattedDate = null;
    if (typeof date === "string") {
      if (date.includes("/")) {
        const [dd, mm, yyyy] = date.split("/");
        if (dd && mm && yyyy) {
          formattedDate = new Date(`${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`);
        }
      } else {
        formattedDate = new Date(date.trim());
      }
    } else if (date instanceof Date) {
      formattedDate = date;
    }

    if (!formattedDate || isNaN(formattedDate.getTime())) {
      throw new Error("Invalid date format");
    }

    const pool = await poolPromise;

    // ✅ Helper to log queries
    function logQuery(query, params) {
      console.log("\n📘 Executing SQL Query:");
      console.log(query.trim());
      console.log("📘 Parameters:");
      Object.entries(params).forEach(([key, val]) => console.log(`  @${key} =`, val));
      console.log("──────────────────────────────");
    }

    // 1️⃣ Insert Casting Record
    const castingQuery = `
      INSERT INTO Casting_dept__c 
      (Name, Issued_Date_c, Wax_Tree_Weight_c, Required_Purity_c, Gold_Tree_Weight_c,
       Required_Pure_Metal_Casting_c, Required_Alloy_for_Casting_c, Issud_weight_c, status_c)
      OUTPUT INSERTED.Id
      VALUES (@castingNumber, @issuedDate, @waxTreeWeight, @purity, @calculatedWeight,
              @requiredPure, @requiredAlloy, @totalIssued, @status)
    `;

    const castingParams = {
      castingNumber,
      issuedDate: formattedDate,
      waxTreeWeight,
      purity,
      calculatedWeight,
      requiredPure: requiredMetals.pureGold,
      requiredAlloy: requiredMetals.alloy,
      totalIssued,
      status: "Open"
    };

    logQuery(castingQuery, castingParams);

    const castingInsert = await pool.request()
      .input("castingNumber", sql.NVarChar, castingNumber)
      .input("issuedDate", sql.DateTime, formattedDate)
      .input("waxTreeWeight", sql.Decimal(18, 3), waxTreeWeight)
      .input("purity", sql.NVarChar, purity)
      .input("calculatedWeight", sql.Decimal(18, 3), calculatedWeight)
      .input("requiredPure", sql.Decimal(18, 3), requiredMetals.pureGold)
      .input("requiredAlloy", sql.Decimal(18, 3), requiredMetals.alloy)
      .input("totalIssued", sql.Decimal(18, 3), totalIssued)
      .input("status", sql.NVarChar, "Open")
      .query(castingQuery);

    const castingId = castingInsert.recordset[0].Id;

    // 2️⃣ Fetch Orders and Update
    const orderIdStr = orders.map(o => `'${o}'`).join(",");
    const orderSelectQuery = `SELECT Id, Order_Id_c FROM Order__c WHERE Order_Id_c IN (${orderIdStr})`;
    console.log("\n📘 Executing Order Select Query:\n", orderSelectQuery);

    const orderQuery = await pool.request().query(orderSelectQuery);
    if (orderQuery.recordset.length !== orders.length) throw new Error("Some orders were not found");

    const orderUpdateQuery = `
      UPDATE Order__c
      SET Casting_c = @castingId,
          Casting_Id_c = @castingNumber
      WHERE Id = @id
    `;

    for (const order of orderQuery.recordset) {
      const orderParams = {
        id: order.Id,
        castingId,
        castingNumber
      };

      logQuery(orderUpdateQuery, orderParams);

      await pool.request()
        .input("id", sql.Int, order.Id)
        .input("castingId", sql.NVarChar, castingNumber)
        .input("castingNumber", sql.NVarChar, castingNumber)
        .query(orderUpdateQuery);
    }

    // ✅ 3️⃣ NEW STEP — Update CastingTree__c status
    const updateTreeQuery = `
      UPDATE CastingTree__c 
      SET status_c = 'Completed' 
      WHERE Name = @castingNumber
    `;
    
    logQuery(updateTreeQuery, { castingNumber });
   
    await pool.request()
      .input("castingNumber", sql.NVarChar, castingNumber)
      .query(updateTreeQuery);
     
    // 4️⃣ Insert Issued Inventory Records
    const issuedInsertQuery = `
      INSERT INTO Issued_inventory__c 
      (Casting_c, Name, Issued_Date_c, Purity_c, Issue_Weight_c, 
       Pure_Metal_weight_c, Alloy_Weight_c)
      VALUES 
      (@castingId, @itemName, @issuedDate, @purity, @issueWeight, @issuedGold, @issuedAlloy)
    `;
     
    for (const item of issuedItems) {
      const issuedParams = {
        castingNumber,
        itemName: item.itemName,
        issuedDate: formattedDate,
        purity: item.purity,
        issueWeight: item.issueWeight,
        issuedGold: item.issuedGold,
        issuedAlloy: item.issuedAlloy
      };
      
      logQuery(issuedInsertQuery, issuedParams);

      await pool.request()
        .input("castingId", sql.NVarChar, castingNumber)
        .input("itemName", sql.NVarChar, item.itemName)
        .input("issuedDate", sql.DateTime, formattedDate)
        .input("purity", sql.NVarChar, item.purity)
        .input("issueWeight", sql.Decimal(18, 3), item.issueWeight)
        .input("issuedGold", sql.Decimal(18, 3), item.issuedGold)
        .input("issuedAlloy", sql.Decimal(18, 3), item.issuedAlloy)
        .query(issuedInsertQuery);
    }
          
    // ✅ Final Response
    res.json({
      success: true,
      message: "Casting process completed successfully",
      data: {
        castingId,
        castingNumber,
        totalIssuedWeight: totalIssued
      }
    });
     
  } catch (error) {
    console.error("❌ Casting error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to complete casting process"
    });
  }
});

app.get("/api/casting", checkSalesforceConnection, async (req, res) => {
  try {
    const pool = req.mssql;

    const query = `
      SELECT 
        Name,
        Issud_weight_c AS Issued_weight,
        Weight_Received_c AS Received_Weight,
        Issued_Date_c AS Issued_Date,
        Received_Date_c AS Received_Date,
        status_c AS status,
        Casting_Loss_c AS Casting_Loss,
        Casting_Scrap_Weight_c AS Scrap_Weight,
        Casting_Dust_Weight_c AS Dust_Weight,
        Casting_Ornament_Weight_c AS Ornament_Weight
      FROM Casting_dept__c
    `;

    const result = await pool.request().query(query);

    res.json({ success: true, data: result.recordset });

  } catch (error) {
    console.error("❌ Error fetching casting data from MSSQL:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**--------FETCHING CASTING DATA FROM SALESFORCE --------- */
app.get("/api/casting/:date/:month/:year/:number", async (req, res) => {
  try {
    const { date, month, year, number } = req.params;
    const castingId = `${date}/${month}/${year}/${number}`; // consistent with your data

    if (!castingId) {
      return res.status(400).json({
        success: false,
        message: "Casting ID is required",
      });
    }

    console.log("🔍 Fetching casting details for ID:", castingId);

    const pool = await poolPromise;

    // 1️⃣ Fetch Casting details
    const castingSQL = `
      SELECT 
        Id,
        Name,
        Issued_Date_c,
        Wax_Tree_Weight_c,
        Required_Purity_c,
        Gold_Tree_Weight_c,
        Required_Pure_Metal_Casting_c,
        Required_Alloy_for_Casting_c,
        Issud_weight_c
      FROM Casting_dept__c
      WHERE Name = @castingId
    `;

    const castingQuery = await pool.request()
      .input("castingId", sql.VarChar, castingId)
      .query(castingSQL);

    if (!castingQuery.recordset || castingQuery.recordset.length === 0) {
      console.log("❌ Casting not found for ID:", castingId);
      console.log("🔍 Executed Query:", castingSQL);
      return res.status(404).json({
        success: false,
        message: "Casting not found",
      });
    }

    const casting = castingQuery.recordset[0];
    console.log("✅ Found casting record:", casting.Name);

    // 2️⃣ Fetch Related Orders
    const ordersSQL = `
      SELECT 
        Id,
        Order_Id_c
      FROM Order__c  
      WHERE Casting_c = @castingId
    `;

    const ordersQuery = await pool.request()
      .input("castingId", sql.VarChar,casting.Name)
      .query(ordersSQL);

    const orders = ordersQuery.recordset || [];

    if (orders.length === 0) {
      console.log("⚠️ No related orders found for casting:", casting.Name);
      console.log("🔍 Executed Query:", ordersSQL);
    }

    // 3️⃣ Fetch Related Inventory Items
    const inventorySQL = `
      SELECT 
        Name,
        Issued_Date_c,
        Purity_c,
        Issue_Weight_c,
        Pure_Metal_weight_c,
        Alloy_Weight_c,
        Casting_c
      FROM Issued_inventory__c 
      WHERE Casting_c = @castingId
    `;

    const inventoryQuery = await pool.request()
      .input("castingId", sql.VarChar, casting.Name)
      .query(inventorySQL);

    const inventoryItems = inventoryQuery.recordset || [];

    if (inventoryItems.length === 0) {
      console.log("⚠️ No inventory items found for casting:", casting.Name);
      console.log("🔍 Executed Query:", inventorySQL);
    }

    // 4️⃣ Compute summary totals safely
    const totalIssuedWeight = inventoryItems.reduce((sum, item) => sum + (item.Issue_Weight_c || 0), 0);
    const totalPureMetalWeight = inventoryItems.reduce((sum, item) => sum + (item.Pure_Metal_weight_c || 0), 0);
    const totalAlloyWeight = inventoryItems.reduce((sum, item) => sum + (item.Alloy_Weight_c || 0), 0);

    // 5️⃣ Prepare response
    const response = {
      success: true,
      message: `Casting details fetched successfully for ID: ${castingId}`,
      data: {
        casting,
        orders,
        inventoryItems,
      },
      summary: {
        totalOrders: orders.length,
        totalInventoryItems: inventoryItems.length,
        totalIssuedWeight,
        totalPureMetalWeight,
        totalAlloyWeight,
      },
    };

    console.log("✅ Casting details fetched successfully for:", casting.Name);
    res.json(response);

  } catch (error) {
    console.error("❌ Error fetching casting details:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch casting details",
    });
  }
});

/**-----------------Get all Casting Details  ----------------- */
 // ensure you're importing mssql

app.get("/api/casting/all/:date/:month/:year/:number",checkSalesforceConnection, async (req, res) => {
  try {
   
    const { date, month, year, number } = req.params;
   // const castingId = `${year}/${month}/${date}/${number}`;

   const castingId = `${date}/${month}/${year}/${number}`; // consistent with your data
    if (!castingId) {
      return res.status(400).json({
        success: false,
        message: "Casting ID is required"
      });
    }

    const pool = req.mssql; // or use your existing pool

    // 1. Get Casting details
    const castingResult = await pool.request()
      .input("castingId", sql.NVarChar, castingId)
      .query(`
        SELECT 
          Id,
          Name,
          Issued_Date_c,
          Issud_weight_c,
          Weight_Received_c,
          Received_Date_c,
          Status_c,
          Casting_Loss_c
        FROM Casting_dept__c
        WHERE Name = @castingId
      `);

    if (!castingResult.recordset || castingResult.recordset.length === 0) {
       console.log("Casting not found for ID:", castingId);
      return res.status(404).json({
        success: false,
        message: "Casting not found"
      });
     
    }

    const casting = castingResult.recordset[0];
    console.log("Found casting record:", casting);

    // 2. Get Related Orders
    const ordersResult = await pool.request()
      .input("castingId", sql.NVarChar, casting.Id)
      .query(`
        SELECT 
          Id,
          Order_Id_c,
          id_c,
          Casting_c
        FROM Order__c 
       
      `);

    const orders = ordersResult.recordset;

    // 3. Get Related Inventory Items
    const inventoryResult = await pool.request()
      .input("castingId", sql.NVarChar, casting.Id)
      .query(`
        SELECT 
          Name,
          Issued_Date_c,
          Purity_c,
          Issue_Weight_c,
          Pure_Metal_weight_c,
          Alloy_Weight_c,
          Casting_c
        FROM Issued_inventory__c 
        WHERE Casting_c = @castingId
      `);

    const inventoryItems = inventoryResult.recordset;

    // 4. Prepare response
    const response = {
      success: true,
      data: {
        casting,
        orders,
        inventoryItems
      },
      summary: {
        totalOrders: orders.length,
        totalInventoryItems: inventoryItems.length,
        totalIssuedWeight: inventoryItems.reduce((sum, item) =>
          sum + (item.Issue_Weight_c || 0), 0),
        totalPureMetalWeight: inventoryItems.reduce((sum, item) =>
          sum + (item.Pure_Metal_weight_c || 0), 0),
        totalAlloyWeight: inventoryItems.reduce((sum, item) =>
          sum + (item.Alloy_Weight_c || 0), 0)
      }
    };

    res.json(response);

  } catch (error) {
    console.error("Error fetching casting details:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch casting details"
    });
  }
});

//#region     ============================================================================================

//#region =========================     Filling     ======================================================

app.get("/api/filing",checkSalesforceConnection, async (req, res) => {
  try {
    console.log('Fetching filing records - API call started');
    const pool = req.mssql;

    const query = `
      SELECT 
        Name,
        Issued_weight_c,
        Issued_Date_c,
        Receievd_weight_c,
        Received_Date_c,
        Order_Id_c,
        Product_c,
        Quantity_c,
        Status_c,
        Filing_loss_c,
        Filing_scrap_Weight_c,
        Filing_Dust_Weight_c
      FROM Filing__c
      ORDER BY Issued_Date_c DESC
    `;

    console.log('Executing SQL query:', query);

    const result = await pool.request().query(query);

    console.log('Raw SQL response:', JSON.stringify(result, null, 2));
    console.log('Number of records found:', result.recordset?.length || 0);

    const filingRecords = result.recordset.map(record => {
      return {
        Name: record.Name,
        Issued_Weight: record.Issued_weight_c,
        Issued_Date: record.Issued_Date_c,
        Received_Weight: record.Receievd_weight_c,
        Received_Date: record.Received_Date_c,
        OrderId: record.Order_Id_c,
        product: record.Product_c,
        quantity: record.Quantity_c,
        Status: record.Status_c,
        Filing_Loss: record.Filing_loss_c,
        Filing_Scrap_Weight: record.Filing_scrap_Weight_c,
        Filing_Dust_Weight: record.Filing_Dust_Weight_c
      };
    });

    console.log('Formatted filing recordsets:', JSON.stringify(filingRecords, null, 2));

    const response = {
      success: true,
      data: filingRecords
    };

    console.log('Sending response to client:', JSON.stringify(response, null, 2));
    res.json(response);

  } catch (error) {
    console.error("Error in /api/filing endpoint:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch filing records from SQL Server",
      error: error.message
    });
  }
});
/**--------------------Grinding Details ----------------- */
app.get("/api/filing/:prefix/:date/:month/:year/:number/:numb", checkSalesforceConnection, async (req, res) => {
  try {
    const pool = req.mssql;
    const { prefix, date, month, year, number, numb } = req.params;
    const filingId = `${prefix}/${date}/${month}/${year}/${number}/${numb}`;
    
    console.log("Requested Filing ID:", filingId);

    // ✅ Query for Filing Details
    const filingQuery = await pool.request()
      .input("filingId", sql.NVarChar, filingId)
      .query(`
        SELECT 
          Id,
          Name,
          Issued_Date_c,
          Issued_weight_c,
          Receievd_weight_c,
          Received_Date_c,
          Status_c,
          Filing_loss_c
        FROM Filing__c
        WHERE CAST(Name AS NVARCHAR(100)) = @filingId
      `);

    if (!filingQuery.recordset || filingQuery.recordset.length === 0) {
      console.log("No records found for filing ID:", filingId);
      return res.status(404).json({
        success: false,
        message: "Filing record not found",
      });
    }

    // ✅ Extract Filing record and ID
    const filing = filingQuery.recordset[0];
    const filingRecordId = filing.Id;
    console.log("Found Filing record with ID:", filingRecordId);

    // ✅ Query for related Pouches using the Filing Id
    const pouchesQuery = await pool.request()
      .input("filingRecordId", sql.Int, filingRecordId)
      .query(`
        SELECT 
          Id,
          Name,
          Order_Id__c,
          Filing__c,
          Issued_Pouch_weight__c
        FROM Pouch__c
        WHERE Filing__c = @filingRecordId
      `);

    console.log("Found pouches:", pouchesQuery.recordset.length);

    // ✅ Build response
    const response = {
      success: true,
      data: {
        filing: filing,
        pouches: pouchesQuery.recordset || [],
      },
    };

    res.json(response);

  } catch (error) {
    console.error("❌ Error fetching filing details:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch filing details",
    });
  }
});
/***-------------Completed Grinding Details ----------------- */
app.get("/api/filing-details/:prefix/:date/:month/:year/:number/:numb",checkMssqlConnection, async (req, res) => {
  try {

    const pool = req.mssql;
    const { prefix, date, month, year, number,numb } = req.params;
    const filingId = `${prefix}/${date}/${month}/${year}/${number}/${numb}`;
        console.log('Requested Filing ID:', filingId);

    // 1. Get Grinding details
    const filingQuery = await pool.request().query(
      `SELECT 
        Id,
        Name,
        Issued_Date_c,
        Issued_weight_c,
        Receievd_weight_c,
        Received_Date_c,
        Status_c,
        Filing_loss_c
       FROM Filing__c
       WHERE Name = '${filingId}'`
    );

    if (!filingQuery.records || filingQuery.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message:   "Filing record not found"
      });s
    }

    const filing = filingQuery.recordset[0];
      console.log('Found filing record:', filing);

    // 2. Get Pouches for this grinding
    const pouchesQuery = await pool.request().query(
      `SELECT 
        Id,
        Name,
        Order_Id_c,
        Issued_Pouch_weight_c
       FROM Pouch__c 
       WHERE Filing_c = '${filing.Id}'`
    );

    console.log('Found pouches:', pouchesQuery.recordset);

    // 3. Get Orders for these pouches
    const orderIds = pouchesQuery.recordset.map(pouch => `'${pouch.Order_Id__c}'`).join(',');
    let orders = [];
    let models = [];


    if (orderIds.length > 0) {
      const ordersQuery = await pool.request().query(
        `SELECT 
          Id,
          Name,
          Order_Id_c,
          Party_Name_c,
          Delivery_Date_c,
          Status_c
         FROM Order_c 
         WHERE Order_Id_c IN (${orderIds})`
      );
      
      orders = ordersQuery.recordset;
      console.log('Found orders:', orders);

      // 4. Get Models for these orders
      const orderIdsForModels = orders.map(order => `'${order.Id}'`).join(',');
      if (orderIdsForModels.length > 0) {
        const modelsQuery = await  pool.request().query(
          `SELECT 
            Id,     
            Name,
            Order_c,
            Category_c,
            Purity_c,
            Size_c,
            Color_c,
            Quantity_c,
            Gross_Weight_c,
            Stone_Weight_c,
            Net_Weight_c
           FROM Order_Models__c 
           WHERE Order_c IN (${orderIdsForModels})`
        );
        
        models = modelsQuery.recordset;
        console.log('Found models:', models);
      }
    }

   // 5. Organize the data hierarchically
// Then in the response construction
const response = {
  success: true,
  data: {
    filing: filing,
    pouches: pouchesQuery.recordset.map(pouch => {
      const relatedOrder = orders.find(order => order.Order_Id__c === pouch.Order_Id__c);
      
      // Now models will have Order__c field to match with
      const pouchModels = relatedOrder ? models.filter(model => 
        model.Order__c === relatedOrder.Id
      ) : [];

      return {
        ...pouch,
        order: relatedOrder || null,
        models: pouchModels
      };
    })
  },
  summary: {
    totalPouches: pouchesQuery.recordset.length,
    totalOrders: orders.length,
    totalModels: models.length,
    totalPouchWeight: pouchesQuery.recordset.reduce((sum, pouch) => 
      sum + (pouch.Issued_Pouch_weight__c || 0), 0),
    issuedWeight: filing.Issued_weight__c,
    receivedWeight: filing.Receievd_weight__c,
    filingLoss: filing.Filing_loss__c
  }
};

// Add debug logging
console.log('Orders mapping:', orders.map(o => ({ id: o.Id, orderId: o.Order_Id__c })));
console.log('Models mapping:', models.map(m => ({ id: m.Id, orderId: m.Order__c })))
 
    console.log('Sending response:', JSON.stringify(response, null, 2));
    res.json(response);

  } catch (error) {
    console.error("Error fetching filing details:", error);
    console.error("Fulal error details:", JSON.stringify(error, null, 2));
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch filing details"
    });
  }
});
/***-------------Grinding Details ----------------- */
/***-------------Fetch pouch details  from filing----------------- */
app.get("/api/filing/:prefix/:date/:month/:year/:number/:subnumber/pouches", checkSalesforceConnection, async (req, res) => {
  try {
    const { prefix, date, month, year, number, subnumber } = req.params;
    const filingId = `${prefix}/${date}/${month}/${year}/${number}/${subnumber}`;

    const pool = req.mssql;

    console.log("[Get Pouches] Fetching pouches for filing:", filingId);

    // ✅ Step 1: Get Filing record (safe parameterized query)
    const filingQuery = await pool.request()
      .input("filingId", sql.NVarChar, filingId)
      .query(`
        SELECT Id 
        FROM Filing__c 
        WHERE CAST(Name AS NVARCHAR(100)) = @filingId
      `);

    if (!filingQuery.recordset || filingQuery.recordset.length === 0) {
      console.log("[Get Pouches] Filing not found:", filingId);
      return res.status(404).json({
        success: false,
        message: "Filing record not found",
      });
    }

    const filingRecordId = filingQuery.recordset[0].Id;
    console.log("[Get Pouches] Found Filing ID:", filingRecordId);

    // ✅ Step 2: Get pouches linked to that Filing
    const pouchesQuery = await pool.request()
      .input("filingRecordId", sql.Int, filingRecordId)
      .query(`
        SELECT 
          Id, 
          Name, 
          Received_Pouch_weight__c,
          Product__c,
          Quantity__c,
          Order_Id__c
        FROM Pouch__c
        WHERE Filing__c = @filingRecordId
      `);

    console.log("[Get Pouches] Found pouches:", pouchesQuery.recordset.length);

    // ✅ Step 3: Send JSON response
    res.json({
      success: true,
      data: {
        filingId,
        pouches: pouchesQuery.recordset,
      },
    });

  } catch (error) {
    console.error("[Get Pouches] Error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch pouches",
    });
  }
});

//#endregion  ============================================================================================


//#region =========================       Grinding     ======================================================

app.get("/api/grinding", checkSalesforceConnection, async(req, res) => {

  const pool = req.mssql;
  try {
    const grindingQuery = await pool.request().query(
      `SELECT Id, Name, Issued_Date__c, Issued_Weight__c,Received_Date__c,Received_Weight__c,Status__c,Grinding_loss__c,Product__c,Quantity__c,Order_Id__c,Grinding_Scrap_Weight__C,Grinding_Dust_Weight__c FROM Grinding__c
       ORDER BY Issued_Date__c DESC`
    );

    res.json({
      success: true,
      data: grindingQuery.recordset
    });
  } catch (error) {
    console.error("Error fetching grinding records:", error); 
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch grinding records"
    });
  }
});

app.get("/api/grinding/:prefix/:date/:month/:year/:number/:subnumber", checkSalesforceConnection, async (req, res) => {
  try {
    const pool = req.mssql;
    const { prefix, date, month, year, number, subnumber } = req.params;
    const grindingId = `${prefix}/${date}/${month}/${year}/${number}/${subnumber}`;
    
    console.log("[Grinding] Requested Grinding ID:", grindingId);

    // ✅ Step 1: Query for grinding details
    const grindingQuery = await pool.request()
      .input("grindingId", sql.NVarChar, grindingId)
      .query(`
        SELECT 
          Id,
          Name,
          Issued_Date__c,
          Issued_Weight__c,
          Received_Weight__c,
          Received_Date__c,
          Product__c,
          Quantity__c,
          Order_Id__c,
          Status__c,
          Grinding_loss__c
        FROM Grinding__c
        WHERE CAST(Name AS NVARCHAR(100)) = @grindingId
      `);

    if (!grindingQuery.recordset || grindingQuery.recordset.length === 0) {
      console.log("[Grinding] No record found for:", grindingId);
      return res.status(404).json({
        success: false,
        message: "Grinding record not found",
      });
    }

    const grinding = grindingQuery.recordset[0];
    console.log("[Grinding] Found record ID:", grinding.Id);

    // ✅ Step 2: Get Related Pouches
    const pouchesQuery = await pool.request()
      .input("grindingRecordId", sql.Int, grinding.Id)
      .query(`
        SELECT 
          Id,
          Name,
          Order_Id__c,
          Grinding__c,
          Isssued_Weight_Grinding__c,
          Product__c,
          Quantity__c
        FROM Pouch__c 
        WHERE Grinding__c = @grindingRecordId
      `);

    console.log("[Grinding] Found pouches:", pouchesQuery.recordset.length);

    // ✅ Step 3: Send response
    const response = {
      success: true,
      data: {
        grinding: grinding,
        pouches: pouchesQuery.recordset || [],
      },
    };

    res.json(response);

  } catch (error) {
    console.error("[Grinding] Error fetching grinding details:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch grinding details",
    });
  }
});

/**-----------------Get all Grinding Details ----------------- */
app.get("/api/grinding-details/:prefix/:date/:month/:year/:number",checkSalesforceConnection, async (req, res) => {
  try {

     const pool = req.mssql;
    const { prefix, date, month, year, number } = req.params;
    const grindingId = `${prefix}/${date}/${month}/${year}/${number}`;

    // 1. Get Grinding details
    const grindingQuery = await pool.request().query(
      `SELECT 
        Id,
        Name,
        Issued_Date__c,
        Issued_Weight__c,
        Received_Weight__c,
        Received_Date__c,
        Status__c,
        Grinding_loss__c
       FROM Grinding__c
       WHERE Name = '${grindingId}'`
    );

    if (!grindingQuery.records || grindingQuery.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Grinding record not found"
      });
    }

    const grinding = grindingQuery.recordset[0];

    // 2. Get Pouches for this grinding
    const pouchesQuery = await pool.request().query(
      `SELECT 
        Id,
        Name,
        Order_Id__c,
        Isssued_Weight_Grinding__c
       FROM Pouch__c 
       WHERE Grinding_c = '${grinding.Id}'`
    );

    // 3. Get Orders for these pouches
    const orderIds = pouchesQuery.recordset.map(pouch => `'${pouch.Order_Id__c}'`).join(',');
    let orders = [];
    let models = [];

    if (orderIds.length > 0) {
      const ordersQuery = await pool.request().query(
        `SELECT 
          Id,
          Name,
          Order_Id_c,
          Party_Name_c,
          Delivery_Date_c,
          Status_c
         FROM Order__c 
         WHERE Order_Id__c IN (${orderIds})`
      );
      
      orders = ordersQuery.recordset;

      // 4. Get Models for these orders
      const orderIdsForModels = orders.map(order => `'${order.Id}'`).join(',');
      if (orderIdsForModels.length > 0) {
        const modelsQuery = await pool.request().query(
          `SELECT 
            Id,     
            Name,
            Order_c,
            Category_c,
            Purity_c,
            Size_c,
            Color_c,
            Quantity_c,
            Gross_Weight_c,
            Stone_Weight_c,
            Net_Weight_c
           FROM Order_Models__c 
           WHERE Order_c IN (${orderIdsForModels})`
        );
        
        models = modelsQuery.records;
      }
    }

    const response = {
      success: true,
      data: {
        grinding: grinding,
        pouches: pouchesQuery.recordset.map(pouch => {
          const relatedOrder = orders.find(order => order.Order_Id__c === pouch.Order_Id__c);
          const pouchModels = relatedOrder ? models.filter(model => 
            model.Order__c === relatedOrder.Id
          ) : [];

          return {
            ...pouch,
            order: relatedOrder || null,
            models: pouchModels
          };
        })
      },
      summary: {
        totalPouches: pouchesQuery.recordset.length,
        totalOrders: orders.length,
        totalModels: models.length,
        totalPouchWeight: pouchesQuery.records.reduce((sum, pouch) => 
          sum + (pouch.Isssued_Weight_Grinding__c || 0), 0),
        issuedWeight: grinding.Issued_Weight__c,
        receivedWeight: grinding.Received_Weight__c,
        grindingLoss: grinding.Grinding_loss__c
      }
    };

    res.json(response);

  } catch (error) {
    console.error("Error fetching grinding details:", error);
    console.error("Full error details:", JSON.stringify(error, null, 2));
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch grinding details"
    });
  }
});
app.post("/api/grinding/update/:prefix/:date/:month/:year/:number/:subnumber", async (req, res) => {
  try {
    const pool = await poolPromise;
    const { prefix, date, month, year, number, subnumber } = req.params;

    // Default missing numeric values to 0
    let {
      issuedWeight = 0,
      receivedDate,
      receivedWeight = 0,
      grindingLoss = 0,
      scrapReceivedWeight = 0,
      findingReceived = 0,
      dustReceivedWeight = 0,
      ornamentWeight = 0,
      pouches = []
    } = req.body;

    // Ensure numeric
    issuedWeight = Number(issuedWeight) || 0;
    receivedWeight = Number(receivedWeight) || 0;
    grindingLoss = Number(grindingLoss) || 0;
    scrapReceivedWeight = Number(scrapReceivedWeight) || 0;
    dustReceivedWeight = Number(dustReceivedWeight) || 0;
    findingReceived = Number(findingReceived) || 0;
    ornamentWeight = Number(ornamentWeight) || 0;

    const grindingNumber = `${prefix}/${date}/${month}/${year}/${number}/${subnumber}`;

    console.log("[Grinding Update SQL] Received data:", {
      grindingNumber,
      receivedDate,
      issuedWeight,
      receivedWeight,
      grindingLoss,
      scrapReceivedWeight,
      dustReceivedWeight,
      findingReceived,
      ornamentWeight
    });

    /** ---- 1. Get Grinding Record ---- **/
    const grindingQuery = await pool.request()
      .input("grindingNumber", sql.NVarChar, grindingNumber)
      .query(`SELECT Id, Name FROM Grinding__C WHERE Name = @grindingNumber`);

    if (grindingQuery.recordset.length === 0) {
      return res.status(404).json({ success: false, message: "Grinding record not found" });
    }

    const grinding = grindingQuery.recordset[0];

    /** ---- 2. Update Grinding Record ---- **/
    await pool.request()
      .input("issuedWeight", sql.Decimal(18, 4), issuedWeight)
      .input("receivedDate", sql.DateTime, receivedDate)
      .input("receivedWeight", sql.Decimal(18, 4), receivedWeight)
      .input("grindingLoss", sql.Decimal(18, 4), grindingLoss)
      .input("scrapReceivedWeight", sql.Decimal(18, 4), scrapReceivedWeight)
      .input("dustReceivedWeight", sql.Decimal(18, 4), dustReceivedWeight)
      .input("findingReceived", sql.Decimal(18, 4), findingReceived)
      .input("ornamentWeight", sql.Decimal(18, 4), ornamentWeight)
      .input("status", sql.NVarChar, "Finished")
      .input("grindingNumber", sql.NVarChar, grindingNumber)
      .query(`
        UPDATE Grinding__C 
        SET 
          Issued_Weight__c = @issuedWeight,
          Received_Date__C = @receivedDate,
          Received_Weight__C = @receivedWeight,
          Grinding_Loss__C = @grindingLoss,
          Grinding_Scrap_Weight__c = @scrapReceivedWeight,
          Grinding_Dust_Weight__c = @dustReceivedWeight,
          Finding_Received__c= @findingReceived,
          Grinding_Ornament_Weight__c= @ornamentWeight,
          Status__C = @status
        WHERE Name = @grindingNumber
      `);

    /** ---- 3. Update Pouches ---- **/
    if (Array.isArray(pouches) && pouches.length > 0) {
      for (const pouch of pouches) {
        await pool.request()
          .input("pouchId", sql.Int, pouch.pouchId)
          .input("receivedWeight", sql.Decimal(18, 4), Number(pouch.receivedWeight) || 0)
          .input("grindingLoss", sql.Decimal(18, 4), grindingLoss)
          .query(`
            UPDATE Pouch__c 
            SET Received_Weight_Grinding__c = @receivedWeight,
                Grinding_Loss__C = @grindingLoss
            WHERE Id = @pouchId
          `);
      }
    }

    /** ---- 4. Update Finding Inventory ---- **/
    if (findingReceived > 0) {
      const result = await pool.request()
        .query(`SELECT TOP 1 Id, Available_Weight_C FROM Inventory_Ledger__C WHERE Item_Name_c = 'Finding' AND Purity_c = '91.7%'`);

      if (result.recordset.length > 0) {
        await pool.request()
          .input("id", sql.Int, result.recordset[0].Id)
          .input("addWeight", sql.Decimal(18, 4), findingReceived)
          .input("receivedDate", sql.DateTime, receivedDate)
          .query(`
            UPDATE Inventory_Ledger__C
            SET Available_Weight_C = Available_Weight_C + @addWeight,
                Last_Updated_C = @receivedDate
            WHERE Id = @id
          `);
      } else {
        await pool.request()
          .input("itemName", sql.NVarChar, "Finding")
          .input("purity", sql.NVarChar, grinding.Purity || "91.7%")
          .input("availableWeight", sql.Decimal(18, 4), findingReceived)
          .input("receivedDate", sql.DateTime, receivedDate)
          .query(`
            INSERT INTO Inventory_Ledger__C (Item_Name_C, Purity_C, Available_Weight_C, Unit_of_Measure_C, Last_Updated_C)
            VALUES (@itemName, @purity, @availableWeight, 'Grams', @receivedDate)
          `);
      }
    }

    /** ---- 5. Scrap Inventory Update ---- **/
    if (scrapReceivedWeight > 0) {
      const scrapCheck = await pool.request()
        .query(`SELECT TOP 1 Id FROM Inventory_Ledger__C WHERE Item_Name_C = 'Scrap' AND Purity = '91.7%'`);
      
      if (scrapCheck.recordset.length > 0) {
        await pool.request()
          .input("id", sql.Int, scrapCheck.recordset[0].Id)
          .input("addWeight", sql.Decimal(18, 4), scrapReceivedWeight)
          .input("receivedDate", sql.DateTime, receivedDate)
          .query(`
            UPDATE Inventory_Ledger__c 
            SET Available_Weight_c = Available_Weight_c + @addWeight,
                Last_Updated_c = @receivedDate
            WHERE Id = @id
          `);
      } else {
        await pool.request()
          .input("itemName", sql.NVarChar, "Scrap")
          .input("purity", sql.NVarChar, grinding.Purity || "91.7%")
          .input("availableWeight", sql.Decimal(18, 4), scrapReceivedWeight)
          .input("receivedDate", sql.DateTime, receivedDate)
          .query(`
            INSERT INTO Inventory_Ledger__c (Item_Name_c, Purity_c, Available_Weight_C, Unit_of_Measure_c, Last_Updated_C)
            VALUES (@itemName, @purity, @availableWeight, 'Grams', @receivedDate)
          `);
      }
    }

    /** ---- 6. Dust Inventory Update ---- **/
    if (dustReceivedWeight > 0) {
      const dustCheck = await pool.request()
        .query(`SELECT TOP 1 Id FROM Inventory_Ledger__C WHERE Item_Name_c = 'G Machine Dust' AND Purity_C = '91.7%'`);

      if (dustCheck.recordset.length > 0) {
        await pool.request()
          .input("id", sql.Int, dustCheck.recordset[0].Id)
          .input("addWeight", sql.Decimal(18, 4), dustReceivedWeight)
          .input("receivedDate", sql.DateTime, receivedDate)
          .query(`
            UPDATE Inventory_Ledger__C
            SET Available_Weight_C = Available_Weight_C + @addWeight,
                Last_Updated_C = @receivedDate
            WHERE Id = @id
          `);
      } else {
        await pool.request()
          .input("itemName", sql.NVarChar, "G Machine Dust")
          .input("purity", sql.NVarChar, grinding.Purity || "91.7%")
          .input("availableWeight", sql.Decimal(18, 4), dustReceivedWeight)
          .input("receivedDate", sql.DateTime, receivedDate)
          .query(`
            INSERT INTO Inventory_Ledger__C (Item_Name_C, Purity_C, Available_Weight_C, Unit_of_Measure_C, Last_Updated_C)
            VALUES (@itemName, @purity, @availableWeight, 'Grams', @receivedDate)
          `);
      }
    }

    /** ---- 7. Final Response ---- **/
    res.json({
      success: true,
      message: "Grinding record updated successfully",
      data: {
        grindingNumber,
        receivedDate,
        receivedWeight,
        grindingLoss,
        scrapReceivedWeight,
        dustReceivedWeight,
        ornamentWeight,
        status: "Finished"
      }
    });

  } catch (error) {
    console.error("[Grinding Update SQL] Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get("/api/grinding/:prefix/:date/:month/:year/:number/:subnumber/pouches",
  checkMssqlConnection,
  async (req, res) => {
    try {
      const pool = req.mssql;
      const { prefix, date, month, year, number, subnumber } = req.params;
      const grindingId = `${prefix}/${date}/${month}/${year}/${number}/${subnumber}`;
      
      console.log('[Get Pouches] Fetching pouches for grinding:', grindingId);

      // ✅ 1. Get Grinding record
      const grindingQuery = await pool.request()
        .input("grindingId", sql.NVarChar(50), grindingId)
        .query(`SELECT Id FROM Grinding__c WHERE Name = @grindingId`);

      console.log('[Get Pouches] Grinding query result:', grindingQuery.recordset);

      if (!grindingQuery.recordset || grindingQuery.recordset.length === 0) {
        console.log('[Get Pouches] Grinding not found:', grindingId);
        return res.status(404).json({
          success: false,
          message: "Grinding record not found"
        });
      }

      const grindingRecord = grindingQuery.recordset[0];

      // ✅ 2. Get related pouches
      const pouchesQuery = await pool.request()
        .input("grindingRef", sql.Int, grindingRecord.Id)
        .query(`
          SELECT 
        Id, 
        Name,
        Isssued_Weight_Grinding__c,
        Received_Weight_Grinding__c,
        Product__c,
        Quantity__c,
        Order_Id__c,
		Grinding__c
       FROM Pouch__c 
          WHERE Grinding__c = @grindingRef
        `);

      console.log('[Get Pouches] Found pouches:', pouchesQuery.recordset);

      return res.json({
        success: true,
        data: {
          pouches: pouchesQuery.recordset
        }
      });   
    } catch (error) {
      console.error("[Get Pouches] Error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to fetch pouches"
      });
    }
  }
);

//#endregion  ============================================================================================

//#region     ========================================    Polishing     ======================================
/**----------------- Get All Polishing Records ----------------- */
app.get("/api/polishing",checkSalesforceConnection, async (req, res) => {
  try {

     const pool = req.mssql;
    console.log('[Get Polishing] Fetching all polishing records');

    const polishingQuery = await pool.request().query(
      `SELECT 
        Id,
        Name,
        Issued_Date__c,
        Issued_Weight__c,
        Received_Weight__c,
        Received_Date__c,
        Quantity__c,
        Order_Id__c,
        Product__c,
        status__c,
        Polishing_loss__c,
        CreatedDate,Polishing_Scrap_Weight__c,Polishing_Dust_Weight__c
       FROM Polishing__c
       ORDER BY CreatedDate DESC`
    );

    console.log('[Get Polishing] Found polishing records:', polishingQuery.recordset.length);

    res.json({
      success: true,
      data: polishingQuery.recordset
    });

  } catch (error) {
    console.error("[Get Polishing] Error:", error);
    console.error("[Get Polishing] Full error details:", JSON.stringify(error, null, 2));
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch polishing records"
    });
  }
});

/**----------------- Get Pouches for Polishing ----------------- */
app.get("/api/polishing/:prefix/:date/:month/:year/:number/:subnumber/pouches",
  checkMssqlConnection,
  async (req, res) => {
    try {
      const pool = req.mssql;
      const { prefix, date, month, year, number, subnumber } = req.params;
      const polsihId = `${prefix}/${date}/${month}/${year}/${number}/${subnumber}`;
      
      console.log('[Get Pouches] Fetching pouches for setting:', polsihId);

      // 1️⃣ Get the Setting record
      const settingQuery = await pool
        .request()
        .input("PolishName", sql.NVarChar, polsihId)
        .query(`
          SELECT Id,
        Name,
        Issued_Date__c,
        Issued_Weight__c,
        Received_Weight__c,
        Received_Date__c,
        Quantity__c,
        Order_Id__c,
        Product__c,
        status__c,
        Polishing_loss__c,
        CreatedDate,Polishing_Scrap_Weight__c,Polishing_Dust_Weight__c  FROM Polishing__c WHERE Name = @PolishName
        `);


      if (!settingQuery.recordset || settingQuery.recordset.length === 0) {
        console.log('[Get Pouches] ❌ Setting not found:', settingId);
        return res.status(404).json({
          success: false,
          message: "Setting record not found",
        });
      }
//

      const polishRecord = settingQuery.recordset[0];
      console.log('[Get Pouches] ✅ Found Setting Id:', polishRecord.Id);

      // 2️⃣ Get related Pouches
      const pouchesQuery = await pool
        .request()
        .input("PolisId", sql.Int, polishRecord.Id)
        .query(`
          SELECT Id, Name, Order_Id__c, Product__c,Issued_Weight_Polishing__c, Received_Weight_Polishing__c, Polishing_Loss__c FROM Pouch__c WHERE Polishing__c = @PolisId
        `);

      console.log('[Get Pouches] ✅ Found pouches count:', pouchesQuery.recordset.length);

      res.json({
        success: true,
        data: {
          pouches: pouchesQuery.recordset || [],
          polishing:settingQuery.recordset||[],
        },
      });
    } catch (error) {
      console.error("[Get Pouches] ❌ Error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to fetch pouches",
      });
    }
  }
);
/**-----------------Update Polishing Received Weight ----------------- */
app.post("/api/polishing/update/:prefix/:date/:month/:year/:number/:subnumber",
  checkMssqlConnection,
  async (req, res) => {
    try {
      const pool = req.mssql;
      const { prefix, date, month, year, number, subnumber } = req.params;
      const {
        receivedDate,
        receivedWeight,
        polishingLoss,
        scrapReceivedWeight,
        dustReceivedWeight,
        ornamentWeight,
        pouches,
      } = req.body;

      const polishingNumber = `${prefix}/${date}/${month}/${year}/${number}/${subnumber}`;

      console.log("[Polishing Update] Received data:", {
        polishingNumber,
        receivedDate,
        receivedWeight,
        polishingLoss,
        scrapReceivedWeight,
        dustReceivedWeight,
        ornamentWeight,
      });

      // 1️⃣ Get the Polishing record
      const polishingQuery = await pool
        .request()
        .input("polishingNumber", sql.NVarChar, polishingNumber)
        .query(`SELECT Id, Name FROM Polishing__c WHERE Name = @polishingNumber`);

      if (!polishingQuery.recordset || polishingQuery.recordset.length === 0) {
        console.log("[Polishing Update] ❌ Record not found:", polishingNumber);
        return res.status(404).json({
          success: false,
          message: "Polishing record not found",
        });
      }

      const polishing = polishingQuery.recordset[0];

      // 2️⃣ Update the polishing record
 await pool
  .request()
  .input("Id", sql.Int, polishing.Id)
  .input("ReceivedDate", sql.Date, receivedDate)
  .input("ReceivedWeight", sql.Decimal(18, 3), receivedWeight)
  .input("PolishingLoss", sql.Decimal(18, 3), polishingLoss)
  .input("ScrapWeight", sql.Decimal(18, 3), scrapReceivedWeight)
  .input("DustWeight", sql.Decimal(18, 3), dustReceivedWeight)
  .input("OrnamentWeight", sql.Decimal(18, 3), ornamentWeight)
  .input("Status", sql.NVarChar, "Finished")
  .query(`
    UPDATE Polishing__c
    SET 
      Received_Date__c = @ReceivedDate,
      Received_Weight__c = @ReceivedWeight,
      Polishing_loss__c = @PolishingLoss,
      Polishing_Scrap_Weight__c = @ScrapWeight,
      Polishing_Dust_Weight__c = @DustWeight,
      Polishing_Ornament_Weight__c = @OrnamentWeight,
      Status__c = @Status
    WHERE Id = @Id
  `);


      console.log("[Polishing Update] ✅ Polishing record updated.");

      // 3️⃣ Update Pouches
      if (pouches && pouches.length > 0) {
        for (const pouch of pouches) {
          await pool
            .request()
            .input("Id", sql.Int, pouch.pouchId)
            .input("Received_Weight_Polishing__c", sql.Decimal(18, 3), pouch.receivedWeight)
            .input("Polishing_Loss__c", sql.Decimal(18, 3), polishingLoss)
            .query(`
              UPDATE Pouch__c
              SET 
                Received_Weight_Polishing__c = @Received_Weight_Polishing__c,
                Polishing_Loss__c = @Polishing_Loss__c
              WHERE Id = @Id
            `);

          console.log(`[Polishing Update] ✅ Updated pouch ${pouch.pouchId}`);
        }
      }

      // 4️⃣ Update Scrap Inventory
      if (scrapReceivedWeight > 0) {
        const scrapInventory = await pool
          .request()
          .query(`
            SELECT Id, Available_weight_c 
            FROM Inventory_ledger__c 
            WHERE Item_Name_c = 'Scrap' AND Purity_c = '91.7%'
          `);

        if (scrapInventory.recordset.length > 0) {
          const currentWeight = scrapInventory.recordset[0].Available_weight__c || 0;
          await pool
            .request()
            .input("Id", sql.Int, scrapInventory.recordset[0].Id)
            .input("Available_weight__c", sql.Decimal(18, 3), currentWeight + scrapReceivedWeight)
            .input("Last_Updated__c", sql.NVarChar, receivedDate)
            .query(`
              UPDATE Inventory_ledger__c
              SET 
                Available_weight_c = @Available_weight__c,
                Last_Updated_c = @Last_Updated__c
              WHERE Id = @Id
            `);
          console.log("[Polishing Update] ✅ Scrap inventory updated.");
        } else {
          await pool
            .request()
            .input("Item_Name__c", sql.NVarChar, "Scrap")
            .input("Purity__c", sql.NVarChar, "91.7%")
            .input("Available_weight__c", sql.Decimal(18, 3), scrapReceivedWeight)
            .input("Unit_of_Measure__c", sql.NVarChar, "Grams")
            .input("Last_Updated__c", sql.NVarChar, receivedDate)
            .query(`
              INSERT INTO Inventory_ledger__c 
              (Item_Name_c, Purity_c, Available_weight_c, Unit_of_Measure_c, Last_Updated_c)
              VALUES (@Item_Name__c, @Purity__c, @Available_weight__c, @Unit_of_Measure__c, @Last_Updated__c)
            `);
          console.log("[Polishing Update] 🆕 Scrap inventory created.");
        }
      }

      // 5️⃣ Update Dust Inventory
      if (dustReceivedWeight > 0) {
        const dustInventory = await pool
          .request()
          .query(`
            SELECT Id, Available_weight_c 
            FROM Inventory_ledger__c 
            WHERE Item_Name__c = 'Dust' AND Purity_c = '91.7%'
          `);

        if (dustInventory.recordset.length > 0) {
          const currentWeight = dustInventory.recordset[0].Available_weight__c || 0;
          await pool
            .request()
            .input("Id", sql.Int, dustInventory.recordset[0].Id)
            .input("Available_weight__c", sql.Decimal(18, 3), currentWeight + dustReceivedWeight)
            .input("Last_Updated__c", sql.NVarChar, receivedDate)
            .query(`
              UPDATE Inventory_ledger__c
              SET 
                Available_weight_c = @Available_weight__c,
                Last_Updated_c = @Last_Updated__c
              WHERE Id = @Id
            `);
          console.log("[Polishing Update] ✅ Dust inventory updated.");
        } else {
          await pool
            .request()
            .input("Item_Name__c", sql.NVarChar, "Dust")
            .input("Purity__c", sql.NVarChar, "91.7%")
            .input("Available_weight__c", sql.Decimal(18, 3), dustReceivedWeight)
            .input("Unit_of_Measure__c", sql.NVarChar, "Grams")
            .input("Last_Updated__c", sql.NVarChar, receivedDate)
            .query(`
              INSERT INTO Inventory_ledger__c 
              (Item_Name_c, Purity_c, Available_weight_c, Unit_of_Measure_c, Last_Updated_c)
              VALUES (@Item_Name__c, @Purity__c, @Available_weight__c, @Unit_of_Measure__c, @Last_Updated__c)
            `);
          console.log("[Polishing Update] 🆕 Dust inventory created.");
        }
      }

      // ✅ Success Response
      res.json({
        success: true,
        message: "Polishing record updated successfully",
        data: {
          polishingNumber,
          receivedDate,
          receivedWeight,
          polishingLoss,
          scrapReceivedWeight,
          dustReceivedWeight,
          ornamentWeight,
          status: "Finished",
        },
      });
    } catch (error) {
      console.error("[Polishing Update] ❌ Error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to update polishing record",
      });
    }
  }
);

/**-----------------Get all Polishing Details -----------------   connection changed   */
app.get("/api/polishing-details/:prefix/:date/:month/:year/:number",checkMssqlConnection, async (req, res) => {
  try {
    const { prefix, date, month, year, number } = req.params;
    const polishingId = `${prefix}/${date}/${month}/${year}/${number}`;
 const pool = req.mssql;
    // 1. Get Polishing details
    const polishingQuery = await pool.request().query(
      `SELECT 
        Id,
        Name,
        Issued_Date_c,
        Issued_Weight_c,
        Received_Weight_c,
        Received_Date_c,
        Status_c,
        Polishing_loss_c
       FROM Polishing__c
       WHERE Name = '${polishingId}'`
    );

    if (!polishingQuery.recordset || polishingQuery.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Polishing record not found"
      });
    }

    const polishing = polishingQuery.recordset[0];

    // 2. Get Pouches for this polishing
    const pouchesQuery = await pool.request().query(
      `SELECT 
        Id,
        Name,
        Order_Id_c,
        Issued_Weight_Polishing_c,
        Received_Weight_Polishing_c
       FROM Pouch__c 
       WHERE Polishing__c = '${polishing.Id}'`
    );

    // 3. Get Orders for these pouches
    const orderIds = pouchesQuery.recordset.map(pouch => `'${pouch.Order_Id__c}'`).join(',');
    let orders = [];
    let models = [];

    if (orderIds.length > 0) {
      const ordersQuery = await pool.request().query(
        `SELECT 
          Id,
          Name,
          Order_Id_c,
          Party_Name_c,
          Delivery_Date_c,
          Status_c
         FROM Order__c 
         WHERE Order_Id_c IN (${orderIds})`
      );
      
      orders = ordersQuery.records;

      // 4. Get Models for these orders
      const orderIdsForModels = orders.map(order => `'${order.Id}'`).join(',');
      if (orderIdsForModels.length > 0) {
        const modelsQuery = await pool.request().query(
          `SELECT 
            Id,     
            Name,
            Order_c,
            Category_c,
            Purity_c,
            Size_c,
            Color_c,
            Quantity_c,
            Gross_Weight_c,
            Stone_Weight_c,
            Net_Weight_c
           FROM Order_Models__c 
           WHERE Order__c IN (${orderIdsForModels})`
        );
        
        models = modelsQuery.recordset;
      }
    }

    const response = {
      success: true,
      data: {
        polishing: polishing,
        pouches: pouchesQuery.recordset.map(pouch => {
          const relatedOrder = orders.find(order => order.Order_Id__c === pouch.Order_Id__c);
          const pouchModels = relatedOrder ? models.filter(model => 
            model.Order__c === relatedOrder.Id
          ) : [];

          return {
            ...pouch,
            order: relatedOrder || null,
            models: pouchModels
          };
        })
      },
      summary: {
        totalPouches: pouchesQuery.recordset.length,
        totalOrders: orders.length,
        totalModels: models.length,
        totalPouchWeight: pouchesQuery.recordset.reduce((sum, pouch) => 
              sum + (pouch.Issued_Weight_Polishing__c || 0), 0),
        issuedWeight: polishing.Issued_Weight__c,
        receivedWeight: polishing.Received_Weight__c,
        polishingLoss: polishing.Polishing_loss__c
      }
    };

    res.json(response);

  } catch (error) {
    console.error("Error fetching polishing details:", error);
    console.error("Full error details:", JSON.stringify(error, null, 2));
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch polishing details"
    });
  }
});

//#endregion  ================================================================================================

//#region     ==========================        Setting       ================================================

/**-----------------Get all Grinding Details ----------------- */
app.post("/api/setting/create", checkMssqlConnection, async (req, res) => {
 
  try {
     const pool = req.mssql;
    const { 
      settingId,
      issuedDate,
      pouches = [],
      totalWeight = 0,
      status,
      product,
      quantity,
      orderId
    } = req.body;

    console.log('[Setting Create] Received data:', { 
      settingId,
      issuedDate,
      pouchCount: pouches.length,
      totalWeight,
      status,
      product,
      quantity,
      orderId
    });

    // 1️⃣ Insert Setting record
    const insertResult = await pool.request()
      .input('Name', settingId)
      .input('IssuedDate', issuedDate)
      .input('TotalWeight', totalWeight)
      .input('Status', status)
      .input('Product', product)
      .input('Quantity', quantity)
      .input('OrderId', orderId)
      .query(`
        INSERT INTO Setting__c 
          (Name, Issued_Date__c, Issued_Weight__c, Status__c, Product__c, Quantity__c, Order_Id_c)
        OUTPUT INSERTED.Id
        VALUES (@Name, @IssuedDate, @TotalWeight, @Status, @Product, @Quantity, @OrderId)
      `);

    const settingRecordId = insertResult.recordset[0].Id;
    console.log('[Setting Create] Setting record created:', settingRecordId);

    // 2️⃣ Update Pouches
    for (const pouch of pouches) {
      console.log('[Setting Create] Updating pouch:', {
        pouchId: pouch.pouchId,
        weight: pouch.settingWeight
      });

      await pool.request()
        .input('PouchId', pouch.pouchId)
        .input('SettingId', settingRecordId)
        .input('Weight', pouch.settingWeight)
        .input('Product', pouch.product)
        .input('Quantity', pouch.quantity)
        .query(`
          UPDATE Pouch__c
          SET 
            Setting__c = @SettingId,
            Issued_weight_setting__c = @Weight,
            Product__c = @Product,
            Quantity__c = @Quantity
          WHERE Id = @PouchId
        `);
    }

    res.json({
      success: true,
      message: "Setting record created successfully",
      data: {
        settingId: settingId,
        settingRecordId,
        pouches
      }
    });

  } catch (error) {
    console.error("[Setting Create] Error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to create setting record"
    });
  }
});

/**-----------------Setting Details ----------------- */
app.get("/api/setting/:prefix/:date/:month/:year/:number/:subnumber", checkMssqlConnection, async (req, res) => {
  try {
    const pool = req.mssql;

    const { prefix, date, month, year, number, subnumber } = req.params;
    const settingId = `${prefix}/${date}/${month}/${year}/${number}/${subnumber}`;

    console.log('[Setting Fetch] Requested Setting ID:', settingId);

    // 🔹 1. Fetch Setting Record
    const settingQuery = await pool.request()
      .input("settingName", sql.NVarChar, settingId)
      .query(`
      
SELECT Id, Name, Issued_Date__c, Issued_Weight__c, Returned_weight__c, Received_Date__c, Status__c, Setting__c FROM Setting__c
        WHERE Name = @settingName
      `);

    if (settingQuery.recordset.length === 0) {
      console.log('[Setting Fetch] ❌ No setting found for:', settingId);
      return res.status(404).json({
        success: false,
        message: "Setting record not found"
      });
    }

    const setting = settingQuery.recordset[0];
    console.log('[Setting Fetch] ✅ Found setting record:', setting);

    // 🔹 2. Fetch Related Pouches
    const pouchQuery = await pool.request()
      .input("settingId", sql.Int, setting.Id)
      .query(`
       SELECT Id, Name, Order_Id__c , Setting__c , Issued_weight_setting__c
        FROM Pouch__c
        WHERE Setting__c = @settingId
      `);

    console.log('[Setting Fetch] 📦 Found related pouches:', pouchQuery.recordset);

    // 🔹 3. Return Response
    const response = {
      success: true,
      data: {
        setting,
        pouches: pouchQuery.recordset
      }
    };

    console.log('[Setting Fetch] ✅ Final Response:', JSON.stringify(response, null, 2));
    res.json(response);

  } catch (error) {
    console.error("[Setting Fetch] ❌ Error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch setting details"
    });
  }
});

/**-----------------Get all Setting Details ----------------- */
app.get("/api/setting-details/:prefix/:date/:month/:year/:number/:subm",checkMssqlConnection, async (req, res) => {
  try {
    const pool = req.mssql;
    const { prefix, date, month, year, number } = req.params;
    const settingId = `${prefix}/${date}/${month}/${year}/${number}`;

    // 1. Get Setting details
    const settingQuery = await pool.request().query(
      `SELECT 
        Id,
        Name,
        Issued_Date__c,
        Issued_Weight__c,
        Returned_weight__c,
        Received_Date__c,
        Status__c,
        Setting__c
       FROM Setting__c
       WHERE Name = '${settingId}'`
    );

    if (!settingQuery.records || settingQuery.records.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Setting record not found"

      } );
    
    }

       
    const setting = settingQuery.records[0];

    // 2. Get Pouches for this setting
    const pouchesQuery = await pool.request().query(
      `SELECT 
        Id,
        Name,
        Order_Id__c,
        Issued_weight_setting__c
       FROM Pouch__c 
       WHERE Setting__c = '${setting.Id}'`
    );

    // 3. Get Orders for these pouches
    const orderIds = pouchesQuery.records.map(pouch => `'${pouch.Order_Id__c}'`).join(',');
    let orders = [];
    let models = [];

    if (orderIds.length > 0) {
      const ordersQuery = await pool.request().query(
        `SELECT 
          Id,
          Name,
          Order_Id_c,
          Party_Name_c,
          Delivery_Date_c,
          Status_c
         FROM Order__c 
         WHERE Order_Id_c IN (${orderIds})`
      );
      
      orders = ordersQuery.recordset;

      // 4. Get Models for these orders
      const orderIdsForModels = orders.map(order => `'${order.Id}'`).join(',');
      if (orderIdsForModels.length > 0) {
        const modelsQuery = await conn.query(
          `SELECT 
            Id,     
            Name,
            Order_c,
            Category_c,
            Purity_c,
            Size_c,
            Color_c,
            Quantity_c,
            Gross_Weight_c,
            Stone_Weight_c,
            Net_Weight_c
           FROM Order_Models__c 
           WHERE Order_c IN (${orderIdsForModels})`
        );
        
        models = modelsQuery.records;
      }
    }

    const response = {
      success: true,
      data: {
        setting: setting,
        pouches: pouchesQuery.recordset.map(pouch => {
          const relatedOrder = orders.find(order => order.Order_Id__c === pouch.Order_Id__c);
          const pouchModels = relatedOrder ? models.filter(model => 
            model.Order__c === relatedOrder.Id
          ) : [];

          return {
            ...pouch,
            order: relatedOrder || null,
            models: pouchModels
          };
        })
      },
      summary: {
        totalPouches: pouchesQuery.recordset.length,
        totalOrders: orders.length,
        totalModels: models.length,
        totalPouchWeight: pouchesQuery.recordset.reduce((sum, pouch) => 
              sum + (pouch.Issued_weight_setting__c || 0), 0),
        issuedWeight: setting.Issued_Weight__c,
        receivedWeight: setting.Returned_weight__c,
        settingLoss: setting.Setting_l__c
      }
    };

    res.json(response);

  } catch (error) {
    console.error("Error fetching setting details:", error);
    console.error("Full error details:", JSON.stringify(error, null, 2));
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch setting details"
    });
  }
});

/**-----------------Update Setting Received Weight ----------------- */
app.post("/api/setting/update/:prefix/:date/:month/:year/:number/:subnumber",
  checkMssqlConnection,
  async (req, res) => {
    try {
      const pool = req.mssql;
      const { prefix, date, month, year, number, subnumber } = req.params;
      const {
        receivedDate,
        receivedWeight,
        settingLoss,
        scrapReceivedWeight,
        dustReceivedWeight,
        totalStoneWeight,
        ornamentWeight,
        pouches,
      } = req.body;

      const settingNumber = `${prefix}/${date}/${month}/${year}/${number}/${subnumber}`;

      console.log("[Setting Update] Received data:", {
        settingNumber,
        receivedDate,
        receivedWeight,
        settingLoss,
        scrapReceivedWeight,
        dustReceivedWeight,
        ornamentWeight,
        pouches,
      });

      // 🔹 1. Get the Setting record
      const settingQuery = await pool
        .request()
        .input("settingNumber", sql.NVarChar, settingNumber)
        .query(`
          SELECT Id, Name
          FROM Setting__c 
          WHERE Name = @settingNumber
        `);

      if (settingQuery.recordset.length === 0) {
        console.log("[Setting Update] ❌ Setting record not found:", settingNumber);
        return res.status(404).json({
          success: false,
          message: "Setting record not found",
        });
      }

      const setting = settingQuery.recordset[0];
      console.log("[Setting Update] ✅ Found Setting Record:", setting);

      // 🔹 2. Update the Setting record
      await pool
        .request()
        .input("receivedDate", sql.DateTime, receivedDate)
        .input("receivedWeight", sql.Decimal(18, 4), receivedWeight)
        .input("settingLoss", sql.Decimal(18, 4), settingLoss)
        .input("stoneWeight", sql.Decimal(18, 4), totalStoneWeight)
        .input("scrapWeight", sql.Decimal(18, 4), scrapReceivedWeight)
        .input("dustWeight", sql.Decimal(18, 4), dustReceivedWeight)
        .input("ornamentWeight", sql.Decimal(18, 4), ornamentWeight)
        .input("settingId", sql.Int, setting.Id)
        .query(`
          UPDATE Setting__c
          SET 
            Received_Date__c = @receivedDate,
            Returned_weight__c = @receivedWeight,
            Setting__c = @settingLoss,
            Stone_Weight__c = @stoneWeight,
            Setting_Scrap_Weight__c = @scrapWeight,
            Setting_Dust_Weight__c = @dustWeight,
            Setting_Ornament_Weight__c = @ornamentWeight,
            Status__c = 'Finished'
          WHERE Id = @settingId
        `);

      console.log("[Setting Update] ✅ Setting__c record updated successfully");

      // 🔹 3. Update related Pouches
      if (pouches && pouches.length > 0) {
        for (const pouch of pouches) {
          console.log(`[Setting Update] 🔁 Updating pouch ${pouch.pouchId}`);

          await pool
            .request()
            .input("pouchId", sql.Int, pouch.pouchId)
            .input("receivedWeight", sql.Decimal(18, 4), pouch.receivedWeight || 0)
            .input("stoneWeight", sql.Decimal(18, 4), pouch.stoneWeight || 0)
            .input("settingLoss", sql.Decimal(18, 4), pouch.settingLoss || 0)
            .query(`
              UPDATE Pouch__c
              SET 
                Received_Weight_Setting__c = @receivedWeight,
                Stone_Weight_Setting__c = @stoneWeight,
                Setting_loss__c = @settingLoss
              WHERE Id = @pouchId
            `);
        }
        console.log("[Setting Update] ✅ All Pouch__c updates completed");
      }

      // 🔹 4. Handle Scrap Inventory
      if (scrapReceivedWeight > 0) {
        const scrapQuery = await pool.request().query(`
          SELECT TOP 1 Id, Available_weight_c 
          FROM Inventory_ledger__c 
          WHERE Item_Name_c = 'Scrap' AND Purity_c = '91.7%'
        `);

        if (scrapQuery.recordset.length > 0) {
          const scrap = scrapQuery.recordset[0];
          await pool
            .request()
            .input("scrapId", sql.Int, scrap.Id)
            .input("newWeight", sql.Decimal(18, 4), scrap.Available_weight__c + scrapReceivedWeight)
            .input("updatedDate", sql.DateTime, receivedDate)
            .query(`
              UPDATE Inventory_ledger__c
              SET Available_weight_c = @newWeight, Last_Updated_c = @updatedDate
              WHERE Id = @scrapId
            `);
          console.log("[Setting Update] ♻️ Scrap inventory updated");
        } else {
          await pool
            .request()
            .input("purity", sql.NVarChar, setting.Purity__c || "91.7%")
            .input("weight", sql.Decimal(18, 4), scrapReceivedWeight)
            .input("updatedDate", sql.DateTime, receivedDate)
            .query(`
              INSERT INTO Inventory_ledger__c 
              (Name, Item_Name_c, Purity_c, Available_weight_c, Unit_of_Measure_c, Last_Updated_c)
              VALUES ('Scrap', 'Scrap', @purity, @weight, 'Grams', @updatedDate)
            `);
          console.log("[Setting Update] 🆕 Scrap inventory created");
        }
      }

      // 🔹 5. Handle Dust Inventory
      if (dustReceivedWeight > 0) {
        const dustQuery = await pool.request().query(`
          SELECT TOP 1 Id, Available_weight_c 
          FROM Inventory_ledger__c 
          WHERE Item_Name_c = 'Dust' AND Purity_c = '91.7%'
        `);

        if (dustQuery.recordset.length > 0) {
          const dust = dustQuery.recordset[0];
          await pool
            .request()
            .input("dustId", sql.Int, dust.Id)
            .input("newWeight", sql.Decimal(18, 4), dust.Available_weight__c + dustReceivedWeight)
            .input("updatedDate", sql.DateTime, receivedDate)
            .query(`
              UPDATE Inventory_ledger__c
              SET Available_weight_c = @newWeight, Last_Updated_c = @updatedDate
              WHERE Id = @dustId
            `);
          console.log("[Setting Update] 💨 Dust inventory updated");
        } else {
          await pool
            .request()
            .input("purity", sql.NVarChar, setting.Purity__c || "91.7%")
            .input("weight", sql.Decimal(18, 4), dustReceivedWeight)
            .input("updatedDate", sql.DateTime, receivedDate)
            .query(`
              INSERT INTO Inventory_ledger__c 
              (Name, Item_Name_c, Purity_c, Available_weight_c, Unit_of_Measure_c, Last_Updated_c)
              VALUES ('Dust', 'Dust', @purity, @weight, 'Grams', @updatedDate)
            `);
          console.log("[Setting Update] 🆕 Dust inventory created");
        }
      }

      // 🔹 6. Final Response
      console.log("[Setting Update] ✅ All updates completed successfully");
      res.json({
        success: true,
        message: "Setting record updated successfully",
        data: {
          settingNumber,
          receivedDate,
          receivedWeight,
          settingLoss,
          scrapReceivedWeight,
          dustReceivedWeight,
          ornamentWeight,
          status: "Finished",
        },
      });
    } catch (error) {
      console.error("[Setting Update] ❌ Error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to update setting record",
      });
    }
  }
);   

/**----------------- Get All Settings ----------------- */
app.get("/api/setting",checkSalesforceConnection, async (req, res) => {
  try {

    const pool = req.mssql;
    console.log('[Get Settings] Fetching all setting records');

    const settingQuery = await pool.request().query(
      `SELECT 
        Id,
        Name,
        Issued_Date__c,
        Issued_Weight__c,
        Returned_weight__c,
        Received_Date__c,
        status__c,
        Product__c,
        Quantity__c,
        Order_Id_c,
        Stone_Weight__c,
        Setting__c,
        CreatedDate,Setting_Scrap_Weight__c,Setting_Dust_Weight__c
       FROM Setting__c
       ORDER BY CreatedDate DESC`
    );

    console.log('[Get Settings] Found settings:', settingQuery.recordset.length);

    res.json({
      success: true,
      data: settingQuery.recordset
    });

  } catch (error) {
    console.error("[Get Settings] Error:", error);
    console.error("[Get Settings] Full error details:", JSON.stringify(error, null, 2));
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch setting records"
    });
  }
});

app.get("/api/setting/:prefix/:date/:month/:year/:number/:subnumber/pouches",
  checkMssqlConnection,
  async (req, res) => {
    try {
      const pool = req.mssql;
      const { prefix, date, month, year, number, subnumber } = req.params;
      const settingId = `${prefix}/${date}/${month}/${year}/${number}/${subnumber}`;
      
      console.log('[Get Pouches] Fetching pouches for setting:', settingId);

      // 1️⃣ Get the Setting record
      const settingQuery = await pool
        .request()
        .input("settingName", sql.NVarChar, settingId)
        .query(`
          SELECT Id FROM Setting__c WHERE Name = @settingName
        `);

      if (!settingQuery.recordset || settingQuery.recordset.length === 0) {
        console.log('[Get Pouches] ❌ Setting not found:', settingId);
        return res.status(404).json({
          success: false,
          message: "Setting record not found",
        });
      }

      const settingRecord = settingQuery.recordset[0];
      console.log('[Get Pouches] ✅ Found Setting Id:', settingRecord.Id);

      // 2️⃣ Get related Pouches
      const pouchesQuery = await pool
        .request()
        .input("settingId", sql.Int, settingRecord.Id)
        .query(`
          SELECT 
            Id, 
            Name,
            Issued_weight_setting__c,
            Received_Weight_Setting__c,
            Product__c,
            Quantity__c,
            Order_Id__c
          FROM Pouch__c 
          WHERE Setting__c = @settingId
        `);

      console.log('[Get Pouches] ✅ Found pouches count:', pouchesQuery.recordset.length);

      res.json({
        success: true,
        data: {
          pouches: pouchesQuery.recordset || [],
        },
      });
    } catch (error) {
      console.error("[Get Pouches] ❌ Error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to fetch pouches",
      });
    }
  }
);

//#endregion    ==============================================================================================

//#region       ======================      Dull      ========================================================


app.post("/api/dull/create", checkMssqlConnection, async (req, res) => {
  try {
    const pool = req.mssql;
    const {
      dullId,
      issuedDate,
      pouches,
      totalWeight,
      status,
      product,
      quantity,
      orderId
    } = req.body;

    console.log('[Dull Create] Received data:', { 
      dullId,
      issuedDate,
      pouchCount: pouches.length,
      totalWeight,
      status
    });

    // 1️⃣ Insert Dull record
    const insertDullQuery = `
      INSERT INTO Dull__c
      (Name, Issued_Date__c, Issued_Weight__c, Status__c, Product__c, Quantity__c, Order_Id__c)
      OUTPUT INSERTED.Id
      VALUES (@dullId, @issuedDate, @totalWeight, @status, @product, @quantity, @orderId)
    `;

    const dullResult = await pool.request()
      .input('dullId', sql.NVarChar, dullId)
      .input('issuedDate', sql.Date, issuedDate)
      .input('totalWeight', sql.Decimal(18,3), totalWeight)
      .input('status', sql.NVarChar, status)
      .input('product', sql.NVarChar, product)
      .input('quantity', sql.Int, quantity)
      .input('orderId', sql.NVarChar, orderId)
      .query(insertDullQuery);

    const dullRecordId = dullResult.recordset[0].Id;
    console.log('[Dull Create] Dull record created with Id:', dullRecordId);

    // 2️⃣ Update each pouch
    const pouchResults = [];
    for (const pouch of pouches) {
      const updatePouchQuery = `
        UPDATE Pouch__c
        SET 
          Dull__c = @dullId,
          Issued_Weight_Dull__c = @dullWeight,
          Product__c = @product,
          Quantity__c = @quantity
        WHERE Id = @pouchId
      `;

      const pouchResult = await pool.request()
        .input('dullId', sql.Int, dullRecordId)
        .input('dullWeight', sql.Decimal(18,3), pouch.dullWeight)
        .input('product', sql.NVarChar, pouch.product)
        .input('quantity', sql.Int, pouch.quantity)
        .input('pouchId', sql.Int, pouch.pouchId)
        .query(updatePouchQuery);

      console.log(`[Dull Create] Updated pouch ${pouch.pouchId}`);
      pouchResults.push({ pouchId: pouch.pouchId, success: true });
    }

    // 3️⃣ Send response
    res.json({
      success: true,
      message: "Dull record created successfully",
      data: {
        dullId: dullId,
        dullRecordId,
        pouches: pouchResults
      }
    });

  } catch (error) {
    console.error("[Dull Create] Error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to create dull record"
    });
  }
});

/**----------------- Get All Dull Records -----------------   connection changed    */
app.get("/api/dull",checkMssqlConnection, async (req, res) => {
  try {
    console.log('[Get Dull] Fetching all dull records');
const pool = req.mssql;
    const dullQuery = await pool.request().query(
      `SELECT 
        Id,
        Name,
        Issued_Date__c,
        Issued_Weight__c,
        Returned_weight__c,
        Received_Date__c,
        status__c,
        Order_Id__c,
        Product__c,
        Quantity__c,
        Dull_loss__c,
        CreatedDate
       FROM Dull__c
       ORDER BY CreatedDate DESC`
    );

    console.log('[Get Dull] Found dull records:', dullQuery.recordset.length);

    res.json({
      success: true,
      data: dullQuery.recordset
    });

  } catch (error) {
    console.error("[Get Dull] Error:", error);
    console.error("[Get Dull] Full error details:", JSON.stringify(error, null, 2));
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch dull records"
    });
  }
});/**-----------------Update Dull Received Weight ----------------- */

app.post("/api/dull/update/:prefix/:date/:month/:year/:number/:subnumber", checkMssqlConnection, async (req, res) => {
  try {
    const pool = req.mssql;
    const { prefix, date, month, year, number, subnumber } = req.params;
    const { 
      receivedDate, 
      receivedWeight, 
      dullLoss, 
      scrapReceivedWeight, 
      dustReceivedWeight, 
      ornamentWeight, 
      pouches 
    } = req.body;

    const dullNumber = `${prefix}/${date}/${month}/${year}/${number}/${subnumber}`;

    console.log('[Dull Update] Received data:', { 
      dullNumber, 
      receivedDate, 
      receivedWeight, 
      dullLoss,
      scrapReceivedWeight,
      dustReceivedWeight,
      ornamentWeight,
      pouches 
    });

    // 1️⃣ Get Dull record
    const dullQuery = await pool.request()
      .input("Name", sql.NVarChar, dullNumber)
      .query(`SELECT Id, Name FROM Dull__c WHERE Name = @Name`);

    if (!dullQuery.recordset || dullQuery.recordset.length === 0) {
      console.log('[Dull Update] ❌ Dull record not found:', dullNumber);
      return res.status(404).json({
        success: false,
        message: "Dull record not found"
      });
    }

    const dull = dullQuery.recordset[0];

    // 2️⃣ Update Dull record
    await pool.request()
      .input("Id", sql.Int, dull.Id)
      .input("Received_Date__c", sql.DateTime, receivedDate)
      .input("Returned_Weight__c", sql.Decimal(18,3), receivedWeight)
      .input("Dull_Loss__c", sql.Decimal(18,3), dullLoss)
      .input("Dull_Scrap_Weight__c", sql.Decimal(18,3), scrapReceivedWeight)
      .input("Dull_Dust_Weight__c", sql.Decimal(18,3), dustReceivedWeight)
      .input("Dull_Ornament_Weight__c", sql.Decimal(18,3), ornamentWeight)
      .input("Status__c", sql.NVarChar, "Finished")
      .query(`
        UPDATE Dull__c
        SET 
          Received_Date__c = @Received_Date__c,
          Returned_Weight__c = @Returned_Weight__c,
          Dull_Loss__c = @Dull_Loss__c,
          Dull_Scrap_Weight__c = @Dull_Scrap_Weight__c,
          Dull_Dust_Weight__c = @Dull_Dust_Weight__c,
          Dull_Ornament_Weight__c = @Dull_Ornament_Weight__c,
          Status__c = @Status__c
        WHERE Id = @Id
      `);

    console.log('[Dull Update] ✅ Dull record updated');

    // 3️⃣ Update Pouches
    if (pouches && pouches.length > 0) {
      for (const pouch of pouches) {
        await pool.request()
          .input("Id", sql.Int, pouch.pouchId)
          .input("Received_Weight_Dull__c", sql.Decimal(18,3), pouch.receivedWeight)
          .input("Dull_Loss__c", sql.Decimal(18,3), dullLoss)
          .query(`
            UPDATE Pouch__c
            SET 
              Received_Weight_Dull__c = @Received_Weight_Dull__c,
              Dull_Loss__c = @Dull_Loss__c
            WHERE Id = @Id
          `);

        console.log(`[Dull Update] ✅ Updated pouch ${pouch.pouchId}`);
      }
    }

    // 4️⃣ Scrap Inventory
    if (scrapReceivedWeight > 0) {
      const scrapQuery = await pool.request()
        .query(`SELECT Id, Available_Weight_c FROM Inventory_ledger__c WHERE Item_Name_c = 'Scrap' AND Purity_c = '91.7%'`);

      if (scrapQuery.recordset.length > 0) {
        const currentWeight = scrapQuery.recordset[0].Available_Weight_c || 0;
        await pool.request()
          .input("Id", sql.Int, scrapQuery.recordset[0].Id)
          .input("Available_Weight__c", sql.Decimal(18,3), currentWeight + scrapReceivedWeight)
          .input("Last_Updated__c", sql.DateTime, receivedDate)
          .query(`
            UPDATE Inventory_ledger__c
            SET Available_Weight_c = @Available_Weight__c,
                Last_Updated_c = @Last_Updated__c
            WHERE Id = @Id
          `);
        console.log('[Dull Update] ✅ Scrap inventory updated');
      } else {
        await pool.request()
          .input("Item_Name__c", sql.NVarChar, "Scrap")
          .input("Purity__c", sql.NVarChar, "91.7%")
          .input("Available_Weight__c", sql.Decimal(18,3), scrapReceivedWeight)
          .input("Unit_of_Measure__c", sql.NVarChar, "Grams")
          .input("Last_Updated__c", sql.DateTime, receivedDate)
          .query(`
            INSERT INTO Inventory_ledger__c
            (Item_Name_c, Purity_c, Available_Weight_c, Unit_of_Measure_c, Last_Updated_c)
            VALUES (@Item_Name__c, @Purity__c, @Available_Weight__c, @Unit_of_Measure__c, @Last_Updated__c)
          `);
        console.log('[Dull Update] 🆕 Scrap inventory created');
      }
    }

    // 5️⃣ Dust Inventory
    if (dustReceivedWeight > 0) {
      const dustQuery = await pool.request()
        .query(`SELECT Id, Available_Weight_c FROM Inventory_ledger__c WHERE Item_Name_c = 'Dust' AND Purity_c = '91.7%'`);

      if (dustQuery.recordset.length > 0) {
        const currentWeight = dustQuery.recordset[0].Available_Weight_c || 0;
        await pool.request()
          .input("Id", sql.Int, dustQuery.recordset[0].Id)
          .input("Available_Weight__c", sql.Decimal(18,3), currentWeight + dustReceivedWeight)
          .input("Last_Updated__c", sql.DateTime, receivedDate)
          .query(`
            UPDATE Inventory_ledger__c
            SET Available_Weight_c = @Available_Weight__c,
                Last_Updated_c = @Last_Updated__c
            WHERE Id = @Id
          `);
        console.log('[Dull Update] ✅ Dust inventory updated');
      } else {
        await pool.request()
          .input("Item_Name__c", sql.NVarChar, "Dust")
          .input("Purity__c", sql.NVarChar, "91.7%")
          .input("Available_Weight__c", sql.Decimal(18,3), dustReceivedWeight)
          .input("Unit_of_Measure__c", sql.NVarChar, "Grams")
          .input("Last_Updated__c", sql.DateTime, receivedDate)
          .query(`
            INSERT INTO Inventory_ledger__c
            (Item_Name_c, Purity_c, Available_Weight_c, Unit_of_Measure_c, Last_Updated_c)
            VALUES (@Item_Name__c, @Purity__c, @Available_Weight__c, @Unit_of_Measure__c, @Last_Updated__c)
          `);
        console.log('[Dull Update] 🆕 Dust inventory created');
      }
    }

    res.json({
      success: true,
      message: "Dull record updated successfully",
      data: {
        dullNumber,
        receivedDate,
        receivedWeight,
        dullLoss,
        scrapReceivedWeight,
        dustReceivedWeight,
        ornamentWeight,
        status: 'Finished'
      }
    });

  } catch (error) {
    console.error("[Dull Update] ❌ Error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to update dull record"
    });
  }
});

/**-----------------Get all Dull Details -----------------    connection changed   */
app.get("/api/dull-details/:prefix/:date/:month/:year/:number",checkMssqlConnection, async (req, res) => {
  try {
    const { prefix, date, month, year, number } = req.params;
    const dullId = `${prefix}/${date}/${month}/${year}/${number}`;
   const pool = req.mssql;
    // 1. Get Dull details
    const dullQuery = await pool.request().query(
      `SELECT 
        Id,
        Name,
        Issued_Date_c,
        Issued_Weight_c,
        Returned_weight_c,
        Received_Date_c,
        Status_c,
        Dull_loss_c
       FROM Dull__c
       WHERE Name = '${dullId}'`
    );

    if (!dullQuery.recordset || dullQuery.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Dull record not found"
      });
    }

    const dull = dullQuery.recordset[0];

    // 2. Get Pouches for this dull
    const pouchesQuery = await pool.request().query(
      `SELECT 
        Id,
        Name,
        Order_Id_c,
        Issued_Weight_Dull_c,
        Received_Weight_Dull_c
       FROM Pouch__c 
       WHERE Dull__c = '${dull.Id}'`
    );

    // 3. Get Orders for these pouches
    const orderIds = pouchesQuery.recordset.map(pouch => `'${pouch.Order_Id_c}'`).join(',');
    let orders = [];
    let models = [];

    if (orderIds.length > 0) {
      const ordersQuery = await pool.request().query(
        `SELECT 
          Id,
          Name,
          Order_Id_c,
          Party_Name_c,
          Delivery_Date_c,
          Status_c
         FROM Order__c 
         WHERE Order_Id_c IN (${orderIds})`
      );
      
      orders = ordersQuery.recordset;

      // 4. Get Models for these orders
      const orderIdsForModels = orders.map(order => `'${order.Id}'`).join(',');
      if (orderIdsForModels.length > 0) {
        const modelsQuery = await pool.request().query(
          `SELECT 
            Id,     
            Name,
            Order__c,
            Category__c,
            Purity__c,
            Size__c,
            Color__c,
            Quantity__c,
            Gross_Weight__c,
            Stone_Weight__c,
            Net_Weight__c
           FROM Order_Models__c 
           WHERE Order__c IN (${orderIdsForModels})`
        );
        
        models = modelsQuery.recordset;
      }
    }

    const response = {
      success: true,
      data: {
        dull: dull,
        pouches: pouchesQuery.recordset.map(pouch => {
          const relatedOrder = orders.find(order => order.Order_Id__c === pouch.Order_Id__c);
          const pouchModels = relatedOrder ? models.filter(model => 
            model.Order__c === relatedOrder.Id
          ) : [];

          return {
            ...pouch,
            order: relatedOrder || null,
            models: pouchModels
          };
        })
      },
      summary: {
        totalPouches: pouchesQuery.records.length,
        totalOrders: orders.length,
        totalModels: models.length,
        totalPouchWeight: pouchesQuery.records.reduce((sum, pouch) => 
              sum + (pouch.Issued_Weight_Dull__c || 0), 0),
        issuedWeight: dull.Issued_Weight__c,
        receivedWeight: dull.Returned_weight__c,
        dullLoss: dull.Dull_loss__c
      }
    };

    res.json(response);

  } catch (error) {
    console.error("Error fetching dull details:", error);
    console.error("Full error details:", JSON.stringify(error, null, 2));
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch dull details"
    });
  }
});


//#endregion      ============================================================================================

//#region  =============================        correction      ==============================================

//<------------------------------------------------------- Correction APIs ----------------- */------------------------ //
app.post("/api/correction/create", checkMssqlConnection, async (req, res) => {
   const pool = req.mssql;
  try {
   

    const { 
      correctionId,
      issuedDate,
      pouches = [],
      totalWeight,
      status,
      product,
      quantity,
      orderId
    } = req.body;

    console.log('[Correction Create SQL] Received data:', { 
      correctionId,
      issuedDate,
      pouchCount: pouches.length,
      totalWeight,
      status,
      product,
      quantity,
      orderId
    });

    // 1. Insert Correction record
    const insertCorrectionQuery = `
      INSERT INTO Correction__c
        (Name, Issued_Date__c, Issued_Weight__c, Status__c, Product__c, Quantity__c, Order_Id__c)
      OUTPUT INSERTED.Id
      VALUES (@Name, @IssuedDate, @IssuedWeight, @Status, @Product, @Quantity, @OrderId)
    `;

    const correctionResult = await pool.request()
      .input("Name", sql.NVarChar(100), correctionId)
      .input("IssuedDate", sql.DateTime, issuedDate)
      .input("IssuedWeight", sql.Decimal(18, 4), totalWeight)
      .input("Status", sql.NVarChar(50), status)
      .input("Product", sql.NVarChar(100), product)
      .input("Quantity", sql.Int, quantity)
      .input("OrderId", sql.NVarChar(50), orderId)
      .query(insertCorrectionQuery);

    const correctionDbId = correctionResult.recordset[0].Id;

    console.log('[Correction Create SQL] Correction record created with ID:', correctionDbId);

    // 2. Update Pouches with the Correction ID and weights
    const pouchResults = [];

    for (const pouch of pouches) {
      const updatePouchQuery = `
        UPDATE Pouch__c
        SET 
          Correction__c = @CorrectionId,
          Isssued_Weight_Correction__c = @Weight,
          Quantity__c = @Quantity
        WHERE Id = @PouchId
      `;

      const pouchResult = await pool.request()
        .input("CorrectionId", sql.Int, correctionDbId)
        .input("Weight", sql.Decimal(18, 4), pouch.correctionWeight)
        .input("Quantity", sql.Int, pouch.quantity)
        .input("PouchId", sql.Int, pouch.pouchId)
        .query(updatePouchQuery);

      pouchResults.push(pouchResult);
      console.log(`[Correction Create SQL] Pouch updated: ${pouch.pouchId}`);
    }

    res.json({
      success: true,
      message: "Correction record created successfully",
      data: {
        correctionId,
        correctionRecordId: correctionDbId,
        pouches: pouchResults
      }
    });

  } catch (error) {
    console.error("[Correction Create SQL] Error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to create correction record"
    });
  }
});


app.get("/api/correction", checkMssqlConnection, async (req, res) => {
  try {
    const pool = req.mssql;

    const correctionQuery = await pool.request().query(`
      SELECT 
        Id, 
        Name, 
        Issued_Date__c, 
        Issued_Weight__c,
        Received_Date__c,
        Received_Weight__c,
        Status__c,
        Grinding_loss__c,
        Product__c,
        Quantity__c,
        Order_Id__c,
        Grinding_Scrap_Weight__c,
        Grinding_Dust_Weight__c
      FROM Correction__c
      ORDER BY Issued_Date__c DESC
    `);

    res.json({
      success: true,
      data: correctionQuery.recordset
    });

  } catch (error) {
    console.error("Error fetching correction records:", error); 
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch correction records"
    });
  }
});


app.get("/api/correction/:prefix/:date/:month/:year/:number/:subnumber", checkMssqlConnection, async (req, res) => {
   const pool = req.mssql;
  try {
   
    const { prefix, date, month, year, number, subnumber } = req.params;
    const correctionID = `${prefix}/${date}/${month}/${year}/${number}/${subnumber}`;
    
    console.log('Requested Correction ID:', correctionID);

    // 1️⃣ Get the Correction record
    const correctionQuery = await pool.request()
      .input('correctionName', correctionID)
      .query(`
        SELECT 
          Id,
          Name,
          Issued_Date__c,
          Issued_Weight__c,
          Received_Weight__c,
          Received_Date__c,
          Product__c,
          Quantity__c,
          Order_Id__c,
          Status__c,
          Grinding_loss__c
        FROM Correction__c
        WHERE Name = @correctionName
      `);

    if (!correctionQuery.recordset || correctionQuery.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Correction record not found"
      });
    }

    const correction = correctionQuery.recordset[0];

    // 2️⃣ Get related Pouches
    const pouchesQuery = await pool.request()
      .input('correctionId', correction.Id)
      .query(`
        SELECT 
          Id,
          Name,
          Order_Id__c,
          Correction__c,
          Isssued_Weight_Correction__c,
          Product__c,
          Quantity__c
        FROM Pouch__c
        WHERE Correction__c = @correctionId
      `);

    res.json({
      success: true,
      data: {
        correction,
        pouches: pouchesQuery.recordset || []
      }
    });

  } catch (error) {
    console.error("Error fetching correction details:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch correction details"
    });
  }
});


//#endregion      ============================================================================================

//#region       ==============================      Media       ==============================================



app.post("/api/media/create",checkMssqlConnection, async (req, res) => {
  try {
    const {
      grindingId,
      issuedDate,
      pouches,
      totalWeight,
      status,
      product,
      quantity,
      orderId
    } = req.body;

    console.log("[Media Create SQL] Received data:", {
      grindingId,
      issuedDate,
      pouchCount: pouches.length,
      totalWeight,
      status,
      product,
      quantity,
      orderId
    });

    const pool = await poolPromise;

    // 1️⃣ Insert the main Media record
    const insertQuery = `
      INSERT INTO Media__c (
        Name,
        Issued_Date__c,
        Issued_Weight__c,
        Status__c,
        Product__c,
        Quantity__c,
        Order_Id__c,
        CreatedDate__c
      )
      OUTPUT INSERTED.Id
      VALUES (@grindingId, @issuedDate, @totalWeight, @status, @product, @quantity, @orderId, GETDATE())
    `;

    const result = await pool.request()
      .input("grindingId", sql.NVarChar(100), grindingId)
      .input("issuedDate", sql.DateTime, issuedDate)
      .input("totalWeight", sql.Decimal(18, 4), totalWeight)
      .input("status", sql.NVarChar(100), status)
      .input("product", sql.NVarChar(255), product)
      .input("quantity", sql.Int, quantity)
      .input("orderId", sql.NVarChar(100), orderId)
      .query(insertQuery);

    const mediaRecordId = result.recordset[0].Id;
    console.log("[Media Create SQL] Media record created with ID:", mediaRecordId);

    // 2️⃣ Update related pouch records
    for (const pouch of pouches) {
      console.log("[Media Create SQL] Updating pouch:", {
        pouchId: pouch.pouchId,
        weight: pouch.grindingWeight
      });

      await pool.request()
        .input("pouchId", sql.Int, pouch.pouchId)
        .input("mediaId", sql.Int, mediaRecordId)
        .input("grindingWeight", sql.Decimal(18, 4), pouch.grindingWeight)
        .input("quantity", sql.Int, pouch.quantity)
        .query(`
          UPDATE Pouch__c
          SET 
            Media__c = @mediaId,
            Isssued_Weight_Media__c = @grindingWeight,
            Quantity__c = @quantity
          WHERE Id = @pouchId
        `);
    }

    res.json({
      success: true,
      message: "Media record created successfully",
      data: {
        grindingId,
        mediaRecordId,
        pouchCount: pouches.length
      }
    });

  } catch (error) {
    console.error("[Media Create SQL] Error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to create media record"
    });
  }
});


app.get("/api/media", checkMssqlConnection,async (req, res) => {
  try {
    const pool = await poolPromise;

    const grindingQuery = await pool.request().query(`
      SELECT 
        Id, 
        Name, 
        Issued_Date__c, 
        Issued_Weight__c,
        Received_Date__c,
        Received_Weight__c,
        Status__c,
        Grinding_Loss__c,
        Product__c,
        Quantity__c,
        Order_Id__c,
        Grinding_Scrap_Weight__c,
        Grinding_Dust_Weight__c
      FROM Media__c
      ORDER BY Issued_Date__c DESC
    `);

    res.json({
      success: true,
      data: grindingQuery.recordset
    });

  } catch (error) {
    console.error("Error fetching media records:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch media records"
    });
  }
});
app.get("/api/media/:prefix/:date/:month/:year/:number/:subnumber", checkMssqlConnection, async (req, res) => {
  try {
    const pool = req.mssql; // connection from middleware
    const { prefix, date, month, year, number, subnumber } = req.params;
    const grindingId = `${prefix}/${date}/${month}/${year}/${number}/${subnumber}`;

    console.log('Requested Grinding ID:', grindingId);

    // 1️⃣ Get Media record
    const grindingQuery = await pool.request()
      .input("grindingId", sql.NVarChar(100), grindingId)
      .query(`
        SELECT 
          Id,
          Name,
          Issued_Date__c,
          Issued_Weight__c,
          Received_Weight__c,
          Received_Date__c,
          Product__c,
          Quantity__c,
          Order_Id__c,
          Status__c,
          Grinding_Loss__c
        FROM Media__c
        WHERE Name = @grindingId
      `);

    if (!grindingQuery.recordset || grindingQuery.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Grinding record not found"
      });
    }

    const grinding = grindingQuery.recordset[0];

    // 2️⃣ Get related pouches
    const pouchesQuery = await pool.request()
      .input("mediaId", sql.Int, grinding.Id)
      .query(`
        SELECT 
          Id,
          Name,
          Order_Id__c,
          Media__c,
          Isssued_Weight_Media__c,
          Product__c,
          Quantity__c
        FROM Pouch__c
        WHERE Media__c = @mediaId
      `);

    const response = {
      success: true,
      data: {
        grinding: grinding,
        pouches: pouchesQuery.recordset || []
      }
    };

    console.log('Sending response:', response);
    res.json(response);

  } catch (error) {
    console.error("Error fetching grinding details:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch grinding details"
    });
  }
});


/**-----------------Get all Grinding Details ----------------- */
app.get("/api/media-details/:prefix/:date/:month/:year/:number/:subnumber", async (req, res) => {
  try {
    const { prefix, date, month, year, number,subnumber } = req.params;
    const grindingId = `${prefix}/${date}/${month}/${year}/${number}/${subnumber}`;

    // 1. Get Grinding details
    const grindingQuery = await conn.query(
      `SELECT 
        Id,
        Name,
        Issued_Date__c,
        Issued_Weight__c,
        Received_Weight__c,
        Received_Date__c,
        Status__c,
        Grinding_loss__c
       FROM Media__c
       WHERE Name = '${grindingId}'`
    );

    if (!grindingQuery.records || grindingQuery.records.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Grinding record not found"
      });
    }

    const grinding = grindingQuery.records[0];

    // 2. Get Pouches for this grinding
    const pouchesQuery = await conn.query(
      `SELECT 
        Id,
        Name,
        Order_Id__c,
        Isssued_Weight_Media__c
       FROM Pouch__c 
       WHERE Grinding__c = '${grinding.Id}'`
    );

    // 3. Get Orders for these pouches
    const orderIds = pouchesQuery.records.map(pouch => `'${pouch.Order_Id__c}'`).join(',');
    let orders = [];
    let models = [];

    if (orderIds.length > 0) {
      const ordersQuery = await conn.query(
        `SELECT 
          Id,
          Name,
          Order_Id__c,
          Party_Name__c,
          Delivery_Date__c,
          Status__c
         FROM Order__c 
         WHERE Order_Id__c IN (${orderIds})`
      );
      
      orders = ordersQuery.records;

      // 4. Get Models for these orders
      const orderIdsForModels = orders.map(order => `'${order.Id}'`).join(',');
      if (orderIdsForModels.length > 0) {
        const modelsQuery = await conn.query(
          `SELECT 
            Id,     
            Name,
            Order__c,
            Category__c,
            Purity__c,
            Size__c,
            Color__c,
            Quantity__c,
            Gross_Weight__c,
            Stone_Weight__c,
            Net_Weight__c
           FROM Order_Models__c 
           WHERE Order__c IN (${orderIdsForModels})`
        );
        
        models = modelsQuery.records;
      }
    }

    const response = {
      success: true,
      data: {
        grinding: grinding,
        pouches: pouchesQuery.records.map(pouch => {
          const relatedOrder = orders.find(order => order.Order_Id__c === pouch.Order_Id__c);
          const pouchModels = relatedOrder ? models.filter(model => 
            model.Order__c === relatedOrder.Id
          ) : [];

          return {
            ...pouch,
            order: relatedOrder || null,
            models: pouchModels
          };
        })
      },
      summary: {
        totalPouches: pouchesQuery.records.length,
        totalOrders: orders.length,
        totalModels: models.length,
        totalPouchWeight: pouchesQuery.records.reduce((sum, pouch) => 
          sum + (pouch.Isssued_Weight_Grinding__c || 0), 0),
        issuedWeight: grinding.Issued_Weight__c,
        receivedWeight: grinding.Received_Weight__c,
        grindingLoss: grinding.Grinding_loss__c
      }
    };

    res.json(response);

  } catch (error) {
    console.error("Error fetching grinding details:", error);
    console.error("Full error details:", JSON.stringify(error, null, 2));
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch grinding details"
    });
  }
});

app.post("/api/media/update/:prefix/:date/:month/:year/:number/:subnumber", checkMssqlConnection, async (req, res) => {
  try {
    const pool = req.mssql;
    const { prefix, date, month, year, number, subnumber } = req.params;

    const grindingNumber = `${prefix}/${date}/${month}/${year}/${number}/${subnumber}`;
    let {
      issuedWeight = 0,
      receivedDate,
      receivedWeight = 0,
      grindingLoss = 0,
      ornamentWeight = 0,
      pouches = []
    } = req.body;

    let findingReceived = Number(req.body.findingReceived || 0);
    let scrapReceivedWeight = Number(req.body.scrapReceivedWeight || req.body.scrapWeight || 0);
    let dustReceivedWeight = Number(req.body.dustReceivedWeight || req.body.dustWeight || 0);

    // Ensure numeric values
    issuedWeight = Number(issuedWeight) || 0;
    receivedWeight = Number(receivedWeight) || 0;
    grindingLoss = Number(grindingLoss) || 0;
    scrapReceivedWeight = Number(scrapReceivedWeight) || 0;
    dustReceivedWeight = Number(dustReceivedWeight) || 0;
    ornamentWeight = Number(ornamentWeight) || 0;

    console.log("[Media Update SQL] Received data:", {
      grindingNumber,
      issuedWeight,
      receivedDate,
      receivedWeight,
      grindingLoss,
      scrapReceivedWeight,
      dustReceivedWeight,
      ornamentWeight,
      findingReceived,
      pouches
    });

    /** ---- 1. Get Media Record ---- **/
    const grindingQuery = await pool.request()
      .input("grindingNumber", sql.NVarChar(100), grindingNumber)
      .query(`
        SELECT Id
        FROM Media__c
        WHERE Name = @grindingNumber
      `);

    if (!grindingQuery.recordset || grindingQuery.recordset.length === 0) {
      return res.status(404).json({ success: false, message: "Media record not found" });
    }

    const grindingId = grindingQuery.recordset[0].Id;

    /** ---- 2. Update Media Record ---- **/
    await pool.request()
      .input("Id", sql.Int, grindingId)
      .input("IssuedWeight", sql.Decimal(18, 4), issuedWeight)
      .input("ReceivedDate", sql.DateTime, receivedDate)
      .input("ReceivedWeight", sql.Decimal(18, 4), receivedWeight)
      .input("GrindingLoss", sql.Decimal(18, 4), grindingLoss)
      .input("ScrapWeight", sql.Decimal(18, 4), scrapReceivedWeight)
      .input("DustWeight", sql.Decimal(18, 4), dustReceivedWeight)
      .input("OrnamentWeight", sql.Decimal(18, 4), ornamentWeight)
      .input("FindingWeight", sql.Decimal(18, 4), findingReceived)
      .input("Status", sql.NVarChar(50), "Finished")
      .query(`
        UPDATE Media__c
        SET 
          Issued_Weight__c = @IssuedWeight,
          Received_Date__c = @ReceivedDate,
          Received_Weight__c = @ReceivedWeight,
          Grinding_Loss__c = @GrindingLoss,
          Grinding_Scrap_Weight__c = @ScrapWeight,
          Grinding_Dust_Weight__c = @DustWeight,
          Grinding_Ornament_Weight__c = @OrnamentWeight,
          Finding_Weight__c = @FindingWeight,
          Status__c = @Status
        WHERE Id = @Id
      `);

    /** ---- 3. Update Pouches ---- **/
    for (const pouch of pouches) {
      await pool.request()
        .input("PouchId", sql.Int, pouch.pouchId)
        .input("ReceivedWeight", sql.Decimal(18, 4), Number(pouch.receivedWeight) || 0)
        .input("MediaLoss", sql.Decimal(18, 4), grindingLoss)
        .query(`
          UPDATE Pouch__c
          SET 
            Received_Weight_media__c = @ReceivedWeight,
            Media_Loss__c = @MediaLoss
          WHERE Id = @PouchId
        `);
    }

    /** ---- 4. Update Inventory Ledger ---- **/
    const inventoryUpdates = [
      { name: "Finding", weight: findingReceived },
      { name: "Scrap", weight: scrapReceivedWeight },
      { name: "G Machine Dust", weight: dustReceivedWeight }
    ];

    for (const item of inventoryUpdates) {
      if (item.weight <= 0) continue;

      const inventoryQuery = await pool.request()
        .input("ItemName", sql.NVarChar(50), item.name)
        .query(`
          SELECT Id, Available_weight_c 
          FROM Inventory_ledger__c
          WHERE Item_Name_c = @ItemName AND Purity_c = '91.7%'
        `);

      if (inventoryQuery.recordset.length > 0) {
        await pool.request()
          .input("Id", sql.Int, inventoryQuery.recordset[0].Id)
          .input("AvailableWeight", sql.Decimal(18, 4), inventoryQuery.recordset[0].Available_weight__c + item.weight)
          .input("LastUpdated", sql.DateTime, receivedDate)
          .query(`
            UPDATE Inventory_ledger__c
            SET Available_weight_c = @AvailableWeight, Last_Updated_c = @LastUpdated
            WHERE Id = @Id
          `);
      } else {
        await pool.request()
          .input("Name", sql.NVarChar(100), item.name)
          .input("ItemName", sql.NVarChar(50), item.name)
          .input("Purity", sql.NVarChar(10), '91.7%')
          .input("AvailableWeight", sql.Decimal(18, 4), item.weight)
          .input("Unit", sql.NVarChar(20), "Grams")
          .input("LastUpdated", sql.DateTime, receivedDate)
          .query(`
            INSERT INTO Inventory_ledger__c
              (Name, Item_Name_c, Purity_c, Available_weight_c, Unit_of_Measure_c, Last_Updated_c)
            VALUES
              (@Name, @ItemName, @Purity, @AvailableWeight, @Unit, @LastUpdated)
          `);
      }
    }

    /** ---- 5. Response ---- **/
    res.json({
      success: true,
      message: "Media record updated successfully",
      data: {
        grindingNumber,
        receivedDate,
        receivedWeight,
        grindingLoss,
        scrapReceivedWeight,
        dustReceivedWeight,
        ornamentWeight,
        status: "Finished"
      }
    });

  } catch (error) {
    console.error("[Media Update SQL] Error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to update media record"
    });
  }
});

app.get("/api/media/:prefix/:date/:month/:year/:number/:subnumber/pouches", checkMssqlConnection, async (req, res) => {
   const pool = req.mssql;
  try {
   
    const { prefix, date, month, year, number, subnumber } = req.params;
    const grindingId = `${prefix}/${date}/${month}/${year}/${number}/${subnumber}`;
    
    console.log('[Get Pouches SQL] Fetching pouches for media:', grindingId);

    // 1. Get the Media record
    const grindingQuery = await pool.request()
      .input("grindingNumber", sql.NVarChar(100), grindingId)
      .query(`
        SELECT Id
        FROM Media__c
        WHERE Name = @grindingNumber
      `);

    if (!grindingQuery.recordset || grindingQuery.recordset.length === 0) {
      console.log('[Get Pouches SQL] Media record not found:', grindingId);
      return res.status(404).json({
        success: false,
        message: "Media record not found"
      });
    }

    const grindingDbId = grindingQuery.recordset[0].Id;

    // 2. Get pouches related to this media
    const pouchesQuery = await pool.request()
      .input("MediaId", sql.Int, grindingDbId)
      .query(`
        SELECT 
          Id, 
          Name,
          Isssued_Weight_Media__c,
          Received_Weight_Media__c,
          Product__c,
          Quantity__c,
          Order_Id__c
        FROM Pouch__c
        WHERE Media__c = @MediaId
      `);

    console.log('[Get Pouches SQL] Found pouches:', pouchesQuery.recordset);

    res.json({
      success: true,
      data: {
        pouches: pouchesQuery.recordset
      }
    });

  } catch (error) {
    console.error("[Get Pouches SQL] Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch pouches"
    });
  }
});


app.post("/api/media-record/create", async (req, res) => {
  try {
    const { 
      grindingId,  
      issuedWeight, 
      issuedDate, 
      pouches,
      orderId,
      quantity,
      name
        
    } = req.body;



    // First create the Grinding record
    const grindingResult = await conn.sobject('Media__C').create({
      Name: grindingId,
      Issued_Weight__c: issuedWeight,
      Issued_Date__c: issuedDate,
      Status__c: 'In progress',
      Product__C : name,
      Order_Id__c: orderId,
      Quantity__c : quantity

    });

    console.log('Media creation result:', grindingResult);

    if (!grindingResult.success) {
      throw new Error('Failed to create Media record');
    }

    // Create WIP pouches
    const pouchRecords = pouches.map(pouch => ({
      Name: pouch.pouchId,
      Media__c: grindingResult.id,
      Order_Id__c: pouch.orderId,
      Isssued_Weight_media__c: pouch.weight,
      Product__c : pouch.name,
      Quantity__c: pouch.quantity
    }));

    console.log('Creating pouches:', pouchRecords);


    const pouchResults = await conn.sobject('Pouch__c').create(pouchRecords);
    console.log('Pouch creation results:', pouchResults);


    // Add this section to create pouch items with clear logging
    if (Array.isArray(pouchResults)) {
      console.log('Starting pouch items creation...');
      

      const pouchItemPromises = pouchResults.map(async (pouchResult, index) => {
        console.log(`Processing pouch ${index + 1}:`, pouchResult);
        

        if (pouches[index].categories && pouches[index].categories.length > 0) {
          console.log(`Found ${pouches[index].categories.length} categories for pouch ${index + 1}`);
          
          const pouchItemRecords = pouches[index].categories.map(category => {
            const itemRecord = {
              Name: category.category,
              WIPPouch__c: pouchResult.id,
              Category__c: category.category,
              Quantity__c: category.quantity
            };
            console.log('Creating pouch item:', itemRecord);
            return itemRecord;
          });

          try {
            console.log(`Attempting to create ${pouchItemRecords.length} pouch items`);
            const itemResults = await conn.sobject('Pouch_Items__c').create(pouchItemRecords);
            
            if (Array.isArray(itemResults)) {
              itemResults.forEach((result, i) => {
                if (result.success) {
                  console.log(`Pouch item ${i + 1} created successfully:`, result);
                } else {
                  console.error(`Pouch item ${i + 1} creation failed:`, result.errors);
                }
              });

            } else {
              if (itemResults.success) {
                console.log('Single pouch item created successfully:', itemResults);
              } else {
                console.error('Single pouch item creation failed:', itemResults.errors);
              }
            }
            
            return itemResults;
          } catch (error) {
            console.error('Error in pouch items creation:', error.message);
            console.error('Full error:', error);
            throw error;
          }
        } else {
          console.log(`No categories found for pouch ${index + 1}`);
        }
      });

      console.log('Waiting for all pouch items to be created...');
      const pouchItemResults = await Promise.all(pouchItemPromises);
      console.log('All pouch items creation completed:', pouchItemResults);
    }

    res.json({
      success: true,
      message: "Grinding record created successfully",
      data: {
        grindingId,
        grindingRecordId: grindingResult.id,
        pouches: pouchResults
      }
    });

  } catch (error) {
    console.error("Error creating grinding record:", error);
    console.error("Full error details:", JSON.stringify(error, null, 2));
    res.status(500).json({
      success: false,
      message: error.message || "Failed to create grinding record"
    });
  }
});


//#endregion        ==========================================================================================

//#region     ==============================      Plating     ================================================

/**----------------- Create Plating Record ----------------- */
app.post("/api/plating/create", checkMssqlConnection, async (req, res) => {
  try {
    const pool = req.mssql;
    const { 
      platingId,  
      issuedDate,
      pouches,
      totalWeight,
      status,
      product,
      quantity,
      orderId
    } = req.body;

    console.log('[Plating Create] Received data:', {
      platingId,
      issuedDate,
      totalWeight,
      status,
      pouchesCount: pouches.length
    });

    // 1️⃣ Create Plating record
    const createPlatingQuery = await pool.request()
      .input("Name", sql.NVarChar, platingId)
      .input("Issued_Date__c", sql.DateTime, issuedDate)
      .input("Issued_Weight__c", sql.Decimal(18,3), totalWeight)
      .input("Status__c", sql.NVarChar, status)
      .input("Product__c", sql.NVarChar, product)
      .input("Quantity__c", sql.Int, quantity)
      .input("Order_Id__c", sql.NVarChar, orderId)
      .query(`
        INSERT INTO Plating__c
        (Name, Issued_Date__c, Issued_Weight__c, Status__c, Product__c, Quantity__c, Order_Id__c)
        VALUES
        (@Name, @Issued_Date__c, @Issued_Weight__c, @Status__c, @Product__c, @Quantity__c, @Order_Id__c);
        SELECT SCOPE_IDENTITY() AS Id;
      `);

    const platingRecordId = createPlatingQuery.recordset[0].Id;
    console.log('[Plating Create] Plating record created with ID:', platingRecordId);

    // 2️⃣ Update existing pouches
    const pouchResults = await Promise.all(pouches.map(async pouch => {
      await pool.request()
        .input("Id", sql.Int, pouch.pouchId)
        .input("Plating__c", sql.NVarChar, platingId) // Store formatted ID
        .input("Issued_Weight_Plating__c", sql.Decimal(18,3), pouch.platingWeight)
        .input("Product__c", sql.NVarChar, pouch.product)
        .input("Quantity__c", sql.Int, pouch.quantity)
        .query(`
          UPDATE Pouch__c
          SET 
            Plating__c = @Plating__c,
            Issued_Weight_Plating__c = @Issued_Weight_Plating__c,
            Product__c = @Product__c,
            Quantity__c = @Quantity__c
          WHERE Id = @Id
        `);
      
      console.log(`[Plating Create] Updated pouch ${pouch.pouchId}`);
      return { pouchId: pouch.pouchId, platingWeight: pouch.platingWeight };
    }));

    // 3️⃣ Return success
    res.json({
      success: true,
      message: "Plating record created successfully",
      data: {
        platingId,
        platingRecordId,
        pouches: pouchResults
      }
    });

  } catch (error) {
    console.error("[Plating Create] Error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to create plating record"
    });
  }
});


/**----------------- Update Plating Received Weight ----------------- */
app.post("/api/plating/update/:prefix/:date/:month/:year/:number/:subnumber", checkMssqlConnection, async (req, res) => {
  try {
    const pool = req.mssql;
    const { prefix, date, month, year, number, subnumber } = req.params;
    const { receivedDate, receivedWeight, platingLoss, scrapReceivedWeight, dustReceivedWeight, ornamentWeight, pouches } = req.body;
    const platingNumber = `${prefix}/${date}/${month}/${year}/${number}/${subnumber}`;

    console.log('[Plating Update] Received data:', { 
      platingNumber, receivedDate, receivedWeight, platingLoss,
      scrapReceivedWeight, dustReceivedWeight, ornamentWeight, pouchesCount: pouches.length
    });

    // 1️⃣ Get the Plating record
    const platingQuery = await pool.request()
      .input("Name", sql.NVarChar, platingNumber)
      .query(`SELECT Id, Name FROM Plating__c WHERE Name = @Name`);

    if (!platingQuery.recordset || platingQuery.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Plating record not found"
      });
    }

    const plating = platingQuery.recordset[0];
    const purity = plating.Purity__c || '91.7%';

    // 2️⃣ Update the Plating record
    await pool.request()
      .input("Id", sql.Int, plating.Id)
      .input("Received_Date__c", sql.DateTime, receivedDate)
      .input("Returned_Weight__c", sql.Decimal(18,3), receivedWeight)
      .input("Plating_Loss__c", sql.Decimal(18,3), platingLoss)
      .input("Plating_Scrap_Weight__c", sql.Decimal(18,3), scrapReceivedWeight)
      .input("Plating_Dust_Weight__c", sql.Decimal(18,3), dustReceivedWeight)
      .input("Plating_Ornament_Weight__c", sql.Decimal(18,3), ornamentWeight)
      .input("Status__c", sql.NVarChar, "Finished")
      .query(`
        UPDATE Plating__c
        SET 
          Received_Date__c = @Received_Date__c,
          Returned_Weight__c = @Returned_Weight__c,
          Plating_Loss__c = @Plating_Loss__c,
          Plating_Scrap_Weight__c = @Plating_Scrap_Weight__c,
          Plating_Dust_Weight__c = @Plating_Dust_Weight__c,
          Plating_Ornament_Weight__c = @Plating_Ornament_Weight__c,
          Status__c = @Status__c
        WHERE Id = @Id
      `);

    console.log('[Plating Update] ✅ Plating record updated');

    // 3️⃣ Update Pouches
    if (pouches && pouches.length > 0) {
      for (const pouch of pouches) {
        await pool.request()
          .input("Id", sql.Int, pouch.pouchId)
          .input("Received_Weight_Plating__c", sql.Decimal(18,3), pouch.receivedWeight)
          .input("Plating_Loss__c", sql.Decimal(18,3), platingLoss)
          .query(`
            UPDATE Pouch__c
            SET 
              Received_Weight_Plating__c = @Received_Weight_Plating__c,
              Plating_Loss__c = @Plating_Loss__c
            WHERE Id = @Id
          `);
        console.log(`[Plating Update] ✅ Updated pouch ${pouch.pouchId}`);
      }
    }

    // 4️⃣ Update Scrap Inventory
    if (scrapReceivedWeight > 0) {
      const scrapQuery = await pool.request()
        .input("Item_Name__c", sql.NVarChar, "Scrap")
        .input("Purity__c", sql.NVarChar, purity)
        .query(`
          SELECT Id, Available_weight_c 
          FROM Inventory_ledger__c
          WHERE Item_Name_c = @Item_Name__c AND Purity_c = @Purity__c
        `);

      if (scrapQuery.recordset.length > 0) {
        const currentWeight = scrapQuery.recordset[0].Available_weight__c || 0;
        await pool.request()
          .input("Id", sql.Int, scrapQuery.recordset[0].Id)
          .input("Available_weight__c", sql.Decimal(18,3), currentWeight + scrapReceivedWeight)
          .input("Last_Updated__c", sql.DateTime, receivedDate)
          .query(`
            UPDATE Inventory_ledger__c
            SET Available_weight_c = @Available_weight__c,
                Last_Updated_c = @Last_Updated__c
            WHERE Id = @Id
          `);
        console.log("[Plating Update] ✅ Scrap inventory updated");
      } else {
        await pool.request()
          .input("Item_Name__c", sql.NVarChar, "Scrap")
          .input("Purity__c", sql.NVarChar, purity)
          .input("Available_weight__c", sql.Decimal(18,3), scrapReceivedWeight)
          .input("Unit_of_Measure__c", sql.NVarChar, "Grams")
          .input("Last_Updated__c", sql.DateTime, receivedDate)
          .query(`
            INSERT INTO Inventory_ledger__c 
            (Item_Name_c, Purity_c, Available_weight_c, Unit_of_Measure_c, Last_Updated__c)
            VALUES (@Item_Name__c, @Purity__c, @Available_weight__c, @Unit_of_Measure__c, @Last_Updated__c)
          `);
        console.log("[Plating Update] 🆕 Scrap inventory created");
      }
    }

    // 5️⃣ Update Dust Inventory
    if (dustReceivedWeight > 0) {
      const dustQuery = await pool.request()
        .input("Item_Name__c", sql.NVarChar, "Dust")
        .input("Purity__c", sql.NVarChar, purity)
        .query(`
          SELECT Id, Available_weight_c 
          FROM Inventory_ledger__c
          WHERE Item_Name_c = @Item_Name__c AND Purity_c = @Purity__c
        `);

      if (dustQuery.recordset.length > 0) {
        const currentWeight = dustQuery.recordset[0].Available_weight__c || 0;
        await pool.request()
          .input("Id", sql.Int, dustQuery.recordset[0].Id)
          .input("Available_weight__c", sql.Decimal(18,3), currentWeight + dustReceivedWeight)
          .input("Last_Updated__c", sql.DateTime, receivedDate)
          .query(`
            UPDATE Inventory_ledger__c
            SET Available_weight_c = @Available_weight__c,
                Last_Updated_c = @Last_Updated__c
            WHERE Id = @Id
          `);
        console.log("[Plating Update] ✅ Dust inventory updated");
      } else {
        await pool.request()
          .input("Item_Name__c", sql.NVarChar, "Dust")
          .input("Purity__c", sql.NVarChar, purity)
          .input("Available_weight__c", sql.Decimal(18,3), dustReceivedWeight)
          .input("Unit_of_Measure__c", sql.NVarChar, "Grams")
          .input("Last_Updated__c", sql.DateTime, receivedDate)
          .query(`
            INSERT INTO Inventory_ledger__c 
            (Item_Name_c, Purity_c, Available_weight_c, Unit_of_Measure_c, Last_Updated_c)
            VALUES (@Item_Name__c, @Purity__c, @Available_weight__c, @Unit_of_Measure__c, @Last_Updated__c)
          `);
        console.log("[Plating Update] 🆕 Dust inventory created");
      }
    }

    // ✅ Success response
    res.json({
      success: true,
      message: "Plating record updated successfully",
      data: { platingNumber, receivedDate, receivedWeight, platingLoss, scrapReceivedWeight, dustReceivedWeight, ornamentWeight, status: 'Finished' }
    });

  } catch (error) {
    console.error("[Plating Update] Error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to update plating record"
    });
  }
});


/**----------------- Get All Plating Records -----------------  connection changed  / table created  */
app.get("/api/plating",checkMssqlConnection, async (req, res) => {
  try {
    console.log('[Get Plating] Fetching all plating records');
 const pool = req.mssql;
    const platingQuery = await pool.request().query(
      `SELECT 
        Id,
        Name,
        Issued_Date__c,
        Issued_Weight__c,
        Returned_weight__c,
        Received_Date__c,
        Status__c,
        Product__c,
        Order_Id__c,
        Quantity__c,
        Plating_loss__c,
        CreatedDate,Plating_Scrap_Weight__c,Plating_Dust_Weight__c
       FROM Plating__c
       ORDER BY CreatedDate DESC`
    );

    console.log('[Get Plating] Found plating records:', platingQuery.recordset.length);

    res.json({
      success: true,
      data: platingQuery.recordset
    });

  } catch (error) {
    console.error("[Get Plating] Error:", error);
    console.error("[Get Plating] Full error details:", JSON.stringify(error, null, 2));
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch plating records"
    });
  }
});






/**----------------- Get Plating Details -----------------  connection changed   / table created  */
app.get("/api/plating-details/:prefix/:date/:month/:year/:number",checkMssqlConnection, async (req, res) => {
  try {
    const { prefix, date, month, year, number } = req.params;
    const platingId = `${prefix}/${date}/${month}/${year}/${number}`;

    const pool = req.mssql;
    // 1. Get Plating details
    const platingQuery = await pool.request().query(
      `SELECT 
        Id,
        Name,
        Issued_Date_c,
        Issued_Weight_c,
        Returned_weight_c,
        Received_Date_c,
        Status_c,
        Plating_loss_c
       FROM Plating__c
       WHERE Name = '${platingId}'`
    );

    if (!platingQuery.recordset || platingQuery.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Plating record not found"
      });
    }

    const plating = platingQuery.recordset[0];

    // 2. Get Pouches for this plating
    const pouchesQuery = await pool.request().query(
      `SELECT 
        Id,
        Name,
        Order_Id_c,
        Issued_Weight_Plating_c,
        Received_Weight_Plating_c
       FROM Pouch__c 
       WHERE Plating__c = '${platingId}'`
    );

    // 3. Get Orders for these pouches
    const orderIds = pouchesQuery.recordset.map(pouch => `'${pouch.Order_Id__c}'`).join(',');
    let orders = [];
    let models = [];

    if (orderIds.length > 0) {
      const ordersQuery = await pool.request().query(
        `SELECT 
          Id,
          Name,
          Order_Id_c,
          Party_Name_c,
          Delivery_Date_c,
          Status_c
         FROM Order__c 
         WHERE Order_Id_c IN (${orderIds})`
      );
      
      orders = ordersQuery.recordset;

      // 4. Get Models for these orders
      const orderIdsForModels = orders.map(order => `'${order.Id}'`).join(',');
      if (orderIdsForModels.length > 0) {
        const modelsQuery = await pool.request().query(
          `SELECT 
            Id,
            Name,
            Order_c,
            Category_c,
            Purity_c,
            Size_c,
            Color_c,
            Quantity_c,
            Gross_Weight_c,
            Stone_Weight_c,
            Net_Weight_c
           FROM Order_Models__c 
           WHERE Order_c IN (${orderIdsForModels})`
        );
        
        models = modelsQuery.recordset;
      }
    }

    const response = {
      success: true,
      data: {
        plating: plating,
        pouches: pouchesQuery.recordset.map(pouch => {
          const relatedOrder = orders.find(order => order.Order_Id__c === pouch.Order_Id__c);
          const pouchModels = relatedOrder ? models.filter(model => 
            model.Order__c === relatedOrder.Id
          ) : [];

          return {
            ...pouch,
            order: relatedOrder || null,
            models: pouchModels
          };
        })
      },
      summary: {
        totalPouches: pouchesQuery.recordset.length,
        totalOrders: orders.length,
        totalModels: models.length,
        totalPouchWeight: pouchesQuery.recordset.reduce((sum, pouch) => 
              sum + (pouch.Issued_Weight_Plating__c || 0), 0),
        issuedWeight: plating.Issued_Weight__c,
        receivedWeight: plating.Returned_weight__c,
        platingLoss: plating.Plating_loss__c
      }
    };

    res.json(response);

  } catch (error) {
    console.error("Error fetching plating details:", error);
    console.error("Full error details:", JSON.stringify(error, null, 2));
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch plating details"
    });
  }
});


/**----------------- Get Pouches for Plating ----------------- connection Changed   / table created  */

app.get("/api/plating/:prefix/:date/:month/:year/:number/:subnumber/pouches",checkMssqlConnection, async (req, res) => {
  try {
    const { prefix, date, month, year, number,subnumber } = req.params;
    const platingId = `${prefix}/${date}/${month}/${year}/${number}/${subnumber}`;
    
    console.log('[Get Plating Pouches] Fetching details for plating:', platingId);

    const pool = req.mssql;

    // First get the Plating record with all fields
    const platingQuery = await pool.request().query(
      `SELECT 
        Id,
        Name,
        Issued_Date__c,
        Issued_Weight__c,
        Returned_weight__c,
        Received_Date__c,
        Status__c,
        Plating_loss__c
       FROM Plating__c 
       WHERE Name = '${platingId}'`
    );

    if (!platingQuery.recordset || platingQuery.recordset.length === 0) {
      console.log('[Get Plating Pouches] Plating not found:', platingId);
      return res.status(404).json({
        success: false,
        message: "Plating record not found"
      });
    }

    // Get pouches with their IDs and weights
    const pouchesQuery = await pool.request().query(
      `SELECT 
        Id, 
        Name,
        Issued_Weight_Plating__c,
        Received_Weight_Plating__c,
        Quantity__c,
        Product__c,
        Order_Id__c
       FROM Pouch__c 
       WHERE Plating__c = '${platingId}'`
    );

    console.log('[Get Plating Pouches] Found pouches:', pouchesQuery.recordset);
    console.log('[Get Plating Pouches] Plating details:', platingQuery.recordset[0]);

    res.json({
      success: true,
      data: {
        plating: platingQuery.recordsets[0],
        pouches: pouchesQuery.recordset
      }
    });

  } catch (error) {
    console.error("[Get Plating Pouches] Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch plating details"
    });
  }
});


//#endregion      ============================================================================================

//#region       ==================================    tree casting      ======================================


app.post("/tree-casting", checkMssqlConnection, async (req, res) => {
  try {
    const { Name, Tree_Weight__c, orderId__c, stones = [] } = req.body;

    if (!stones.length) {
      return res.json({ success: false, message: "No stones selected" });
    }

    const pool = req.mssql;

    function logQuery(query, params) {
      console.log("\n📘 Executing SQL Query:");
      console.log(query.trim());
      console.log("📘 Parameters:");
      Object.entries(params).forEach(([key, val]) => console.log(`  @${key} =`, val));
      console.log("──────────────────────────────");
    }

    // combined values
    const totalStoneWeight = stones.reduce((sum, s) => sum + (parseFloat(s.weight) || 0), 0);
    const stoneType = stones.map(s => s.type || "unknown").join(", ");
    const stoneColor = stones.map(s => s.color || "unknown").join(", ");
    const stoneShape = stones.map(s => s.shape || "unknown").join(", ");
    const issuedDate = new Date().toISOString().split("T")[0];

    // 1) Insert parent tree and get Id
    const treeInsertQuery = `
      INSERT INTO CastingTree__c 
      (Name, Tree_Weight_c, stone_type_c, stone_color_c, stone_shape_c, stone_weight_c,
       OrderID_c, status_c, issued_Date_c, CreatedDate, createdById)
      OUTPUT INSERTED.Id
      VALUES (@Name, @TreeWeight, @stoneType, @stoneColor, @stoneShape, @stoneWeight,
              @OrderID, @status, @issuedDate, GETDATE(), 'waxing')
    `;

    const treeParams = {
      Name,
      TreeWeight: Tree_Weight__c,
      stoneType,
      stoneColor,
      stoneShape,
      stoneWeight: totalStoneWeight,
      OrderID: orderId__c,
      status: "Pending",
      issuedDate
    };

    logQuery(treeInsertQuery, treeParams);

    const treeInsert = await pool.request()
      .input("Name", sql.NVarChar, Name)
      .input("TreeWeight", sql.Decimal(18, 3), Tree_Weight__c)
      .input("stoneType", sql.NVarChar, stoneType)
      .input("stoneColor", sql.NVarChar, stoneColor)
      .input("stoneShape", sql.NVarChar, stoneShape)
      .input("stoneWeight", sql.Decimal(18, 3), totalStoneWeight)
      .input("OrderID", sql.NVarChar, orderId__c)
      .input("status", sql.NVarChar, "Pending")
      .input("issuedDate", sql.DateTime, issuedDate)
      .query(treeInsertQuery);

    const treeId = treeInsert.recordset[0].Id;
    console.log("✅ Tree Casting created with ID:", treeId);

    // 2) Insert stones and update Stone_Master stock
    const stoneInsertQuery = `
      INSERT INTO TreeStone__c 
      (castingTree_c, Stone_Master_c, Name_c, Type_c, Colour_c, Shape_c, Size_c, Pieces_c, Weight_c, createdById, CreatedDate)
      VALUES
      (@castingTree, @StoneMasterId, @StoneName, @StoneType, @StoneColour, @StoneShape, @StoneSize, @StonePieces, @StoneWeight, 'Waxing', GETDATE())
    `;

    const stoneUpdateQuery = `
      UPDATE Stone_Master__c
      SET Weight_c = @UpdatedWeight
      WHERE Id = @StoneId
    `;

    for (const stone of stones) {
      const stoneWeight = parseFloat(stone.weight) || 0;

      // Normalize size (handle object/array/number)
      const sizeValue =
        typeof stone.size === "object"
          ? stone.size.label || stone.size.value || ""
          : String(stone.size ?? "");

      // Insert TreeStone row (castingTree should be the new treeId)
      const insertParams = {
        castingTree: treeId,
        StoneMasterId: stone.id ?? null,
        StoneName: stone.name ?? "Unnamed Stone",
        StoneType: stone.type ?? "",
        StoneColour: stone.color ?? "",
        StoneShape: stone.shape ?? "",
        StoneSize: sizeValue,
        StonePieces: stone.pcs ?? 0,
        StoneWeight: stoneWeight
      };

      logQuery(stoneInsertQuery, insertParams);

      await pool.request()
        .input("castingTree", sql.NVarChar, String(treeId))
        .input("StoneMasterId", sql.Int, stone.id || null)
        .input("StoneName", sql.NVarChar, stone.name || "Unnamed Stone")
        .input("StoneType", sql.NVarChar, stone.type || "")
        .input("StoneColour", sql.NVarChar, stone.color || "")
        .input("StoneShape", sql.NVarChar, stone.shape || "")
        .input("StoneSize", sql.NVarChar, sizeValue)
        .input("StonePieces", sql.Int, stone.pcs || 0)
        .input("StoneWeight", sql.Decimal(18, 3), stoneWeight)
        .query(stoneInsertQuery);

      // 3) Update Stone_Master stock (only if stone.id provided)
      if (stone.id != null) {
        // use same param type as stored Id (assuming Int)
        const selectParams = { StoneId: stone.id };
        logQuery(`SELECT Id, Weight_c FROM Stone_Master__c WHERE Id = @StoneId`, selectParams);

        const stoneSelect = await pool.request()
          .input("StoneId", sql.Int, stone.id)
          .query(`SELECT Id, Weight_c FROM Stone_Master__c WHERE Id = @StoneId`);

        if (stoneSelect.recordset.length > 0) {
          const dbStone = stoneSelect.recordset[0];

          // IMPORTANT: access the exact column name returned by SQL (Weight_c)
          const currentWeight = Number(dbStone.Weight_c ?? 0);
          const updatedWeight = currentWeight - stoneWeight;

          if (updatedWeight >= 0) {
            const updateParams = { StoneId: dbStone.Id, UpdatedWeight: updatedWeight };
            logQuery(stoneUpdateQuery, updateParams);

            await pool.request()
              .input("StoneId", sql.Int, dbStone.Id)
              .input("UpdatedWeight", sql.Decimal(18, 3), updatedWeight)
              .query(stoneUpdateQuery);

            console.log(`✅ Updated stone stock Id=${dbStone.Id}, from ${currentWeight} -> ${updatedWeight}`);
          } else {
            console.warn(`⚠️ Skipping negative stock update for stone id=${stone.id} name=${stone.name}. current=${currentWeight}, required=${stoneWeight}`);
          }
        } else {
          console.warn(`⚠️ Stone_Master record not found for Id=${stone.id}`);
        }
      } else {
        console.warn(`⚠️ Skipping inventory update for stone without Id (name=${stone.name || "unknown"})`);
      }
    }

    // Done
    res.json({ success: true, message: "Tree Casting created successfully", data: { treeId, Name } });
  } catch (error) {
    console.error("❌ Error saving tree casting:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Server error while creating tree casting"
    });
  }
});

  // GET /casting-trees
app.get("/casting-trees", checkMssqlConnection, async (req, res) => {
  try {
    const pool = req.mssql;

    const query = `
      SELECT TOP 50
        Id,
        Name,
        Tree_Weight_c,
        issued_Date_c,
        OrderID_C,
        stone_weight_c,
        status_c
      FROM CastingTree__c
      WHERE status_c = 'Pending'
      ORDER BY CreatedDate DESC
    `;

    const result = await pool.request().query(query);

    res.json({
      success: true,
      data: result.recordset
    });
  } catch (error) {
    console.error("Error fetching casting trees:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch trees"
    });
  }
});


app.get("/casting-trees/all", checkMssqlConnection, async (req, res) => {
  try {
    const pool = req.mssql;

    const query = `
      SELECT 
        Id,
        Name,
        Tree_Weight_c,
       issued_Date_c,
        OrderID_C,
        stone_color_c,
        stone_name_c,
        stone_pcs_c,
        stone_shape_c,
        stone_size_c,
        stone_type_c,
        status_c,
        stone_weight_c
      FROM CastingTree__c
      ORDER BY CreatedDate DESC
    `;

    const result = await pool.request().query(query);

    res.json({
      success: true,
      data: result.recordset
    });
  } catch (error) {
    console.error("Error fetching casting trees:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch casting trees"
    });
  }
});



//#endregion      ============================================================================================