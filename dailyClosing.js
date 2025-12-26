const sql = require("mssql");
const config = require("./dbConfig"); // your MSSQL config

async function runDailyClosing() {
  try {
    const pool = await sql.connect(config);

    const now = new Date();
    const todayDateOnly = now.toISOString().split("T")[0];

    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    const tomorrowDateOnly = tomorrow.toISOString().split("T")[0];

    // 1. CHECK TOMORROW OPENING
    const checkTomorrow = await pool.request()
      .input("date", sql.Date, tomorrowDateOnly)
      .query(`
        SELECT 1 FROM DailyInventory 
        WHERE CAST(openingDate AS DATE) = @date
      `);

    if (checkTomorrow.recordset.length > 0) {
      console.log("Already closed today.");
      return;
    }

    // 2. FETCH LIVE STOCK
    const ledger = await pool.request().query(`
      SELECT Name, Purity_c, Available_weight_c 
      FROM Inventory_ledger__c
    `);

    // 3. UPDATE TODAY CLOSING
    for (let row of ledger.recordset) {
      const purity = parseFloat(row.Purity_c.replace("%", ""));
      const pureWeight = (row.Available_weight_c * purity) / 100;

      await pool.request()
        .input("item", sql.NVarChar, row.Name)
        .input("closingWeight", sql.Decimal(18, 4), row.Available_weight_c)
        .input("closingPureWeight", sql.Decimal(18, 4), pureWeight)
        .input("closingDate", sql.Date, now)
        .input("today", sql.Date, todayDateOnly)
        .query(`
          UPDATE DailyInventory 
          SET closingWeight=@closingWeight,
              closingPureWeight=@closingPureWeight,
              closingDate=@closingDate
          WHERE itemName=@item
          AND CAST(openingDate AS DATE)=@today
        `);
    }

    // 4. INSERT TOMORROW OPENING
    for (let row of ledger.recordset) {
      const purity = parseFloat(row.Purity_c.replace("%", ""));
      const pureWeight = (row.Available_weight_c * purity) / 100;

      await pool.request()
        .input("item", sql.NVarChar, row.Name)
        .input("openingWeight", sql.Decimal(18, 4), row.Available_weight_c)
        .input("openingPureWeight", sql.Decimal(18, 4), pureWeight)
        .input("purity", sql.NVarChar, purity.toString())
        .input("openingDate", sql.Date, tomorrowDateOnly)
        .query(`
          INSERT INTO DailyInventory
          (itemName, openingWeight, openingPureWeight, purity, openingDate)
          VALUES (@item,@openingWeight,@openingPureWeight,@purity,@openingDate)
        `);
    }

    console.log("Daily closing completed successfully");

  } catch (err) {
    console.error("Error:", err);
  } finally {
    sql.close();
  }
}

runDailyClosing();
