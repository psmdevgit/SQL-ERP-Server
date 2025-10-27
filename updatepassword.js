const jsforce = require('jsforce');
const bcrypt = require('bcrypt');
require('dotenv').config();

const conn = new jsforce.Connection({
  loginUrl: process.env.SALESFORCE_LOGIN_URL,
});

async function updatePasswords() {
  try {
    await conn.login(process.env.SALESFORCE_USERNAME, process.env.SALESFORCE_PASSWORD);

    // Query all users in the CustomUser__c object including Id
    const result = await conn.query(`SELECT Id, Username__c, Password__c FROM CustomUser__c`);
    
    for (const user of result.records) {
      console.log(`Processing user: ${user.Username__c}`);
      console.log(`Plain-text password: ${user.Password__c}`);

      // Skip users with no password set
      if (!user.Password__c) {
        console.error(`User ${user.Username__c} has no password to hash. Skipping...`);
        continue;
      }

      // Hash the plain-text password
      const hashedPassword = await bcrypt.hash(user.Password__c, 10);
      console.log(`Hashed password for user ${user.Username__c}: ${hashedPassword}`);

      // Update the user's password in Salesforce using Id
      await conn.sobject('CustomUser__c').update({
        Id: user.Id,  // Use the Id for updating
        Password__c: hashedPassword,
      });

      console.log(`Updated password for user: ${user.Username__c}`);
    }

    console.log('All passwords updated successfully!');
  } catch (error) {
    console.error('Error updating passwords:', error);
  }
}

updatePasswords();
