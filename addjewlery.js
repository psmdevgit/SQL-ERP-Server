const fs = require("fs");
const path = require("path");
const sql = require("mssql");

async function addJewelryModel(req, data, file) {
  try {
    let imageUrl = null;

    // ✅ Handle File Upload
    if (file) {
      try {
        const uploadDir = path.join(__dirname, "Upload", "model");

        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
          console.log("📁 Created folder:", uploadDir);
        }

        const ext = path.extname(file.originalname);
        const safeModelName = data["Model-name"].replace(/[<>:"/\\|?*]+/g, "_");
        const newFileName = `${safeModelName}${ext}`;
        const filePath = path.join(uploadDir, newFileName);

        fs.writeFileSync(filePath, file.buffer);
        console.log("✅ File saved locally at:", filePath);

        imageUrl = `/Upload/model/${newFileName}`;
      } catch (uploadError) {
        console.error("❌ Error saving file locally:", uploadError);
      }
    }

    // ✅ Prepare SQL data safely
    const jewelryData = {      
      SubmitBy : data["submitby"] || null,   
      Name : data["Model-name"] || null,      
      Name_c : data["Model-name"] || null,
      Item_c: data["item-group"] || null,
      Design_Source_c: data["design-source"] || null,
      Project_c: data["project"] || null,
      Category_c: data["category"] || null,
      Model_Name_c: data["Model-name"] || null,
      Die_No_c: data["die-no"] || null,
      Sketch_No_c: data["sketch-no"] || null,
      Branch_c: data["branch"] || null,
      Brand_c: data["brand"] || null,
      Collection_c: data["collection"] || null,
      Purity_c: data["purity"] || null,
      Color_c: data["color"] || null,
      Size_c: data["size"] || null,
      Stone_Type_c: data["stone-type"] || null,
      Style_c: data["style"] || null,
      Shape_c: data["shape"] || null,
      Stone_Setting_c: data["stone-setting"] || null,
      Pieces_c: data["pieces"] ? parseInt(data["pieces"], 10) : null,
      Unit_Type_c: data["unit-type"] || null,
      Rate_c: data["rate"] ? parseFloat(data["rate"]) : null,
      Minimum_Stock_Level_c: data["minimum-stock-level"]
        ? parseInt(data["minimum-stock-level"], 10)
        : null,
      Material_c: data["material"] || null,
      Gender_c: data["gender"] || null,
      Measurments_c: data["measurements"] || null,
      Router_c: data["router"] || null,
      Master_Weight_c: data["master-weight"]
        ? parseFloat(data["master-weight"])
        : null,
      Wax_Piece_c: data["wax-piece-weight"]
        ? parseFloat(data["wax-piece-weight"])
        : null,
      Creator_c: data["creator"] || null,
      Gross_Weight_c: data["gross-weight"]
        ? parseFloat(data["gross-weight"])
        : null,
      Stone_Weight_c: data["stone-weight"]
        ? parseFloat(data["stone-weight"])
        : null,
      Net_Weight_c: data["net-weight"]
        ? parseFloat(data["net-weight"])
        : null,
      Stone_Amount_c: data["stone-amount"]
        ? parseFloat(data["stone-amount"])
        : null,
      Other_Weight_c: data["other-weight"]
        ? parseFloat(data["other-weight"])
        : null,
      Other_Amount_c: data["other-amount"]
        ? parseFloat(data["other-amount"])
        : null,
      Cad_Path_c: data["cad-path"] || null,
      Location_c: data["location"] || null,
      Image_URL_c: imageUrl || null,
    };

    // ✅ Use connection from request (middleware should set req.mssql)
    const pool = req.mssql;


// Get current date-time in SQL-compatible format
const now = new Date();
const createdDate = now.toISOString().slice(0, 19).replace("T", " "); 

    const insertQuery = `
      INSERT INTO Jewlery_Model__c (
        Submitby_c, Name, Name_c, Item_c, Design_Source_c, Project_c, Category_c, Model_Name_c,
        Die_No_c, Sketch_No_c, Branch_c, Brand_c, Collection_c, Purity_c, Color_c,
        Size_c, Stone_Type_c, Style_c, Shape_c, Stone_Setting_c, Pieces_c, Unit_Type_c,
        Rate_c, Minimum_Stock_Level_c, Material_c, Gender_c, Measurments_c, Router_c,
        Master_Weight_c, Wax_Piece_c, Creator_c, Gross_Weight_c, Stone_Weight_c,
        Net_Weight_c, Stone_Amount_c, Other_Weight_c, Other_Amount_c, Cad_Path_c,
        Location_c, Image_URL_c, CreatedDate, CreatedDate_c
      )
      OUTPUT INSERTED.Id
      VALUES (
        @SubmitBy, @Name, @Name_c, @Item_c, @Design_Source_c, @Project_c, @Category_c, @Model_Name_c,
        @Die_No_c, @Sketch_No_c, @Branch_c, @Brand_c, @Collection_c, @Purity_c, @Color_c,
        @Size_c, @Stone_Type_c, @Style_c, @Shape_c, @Stone_Setting_c, @Pieces_c, @Unit_Type_c,
        @Rate_c, @Minimum_Stock_Level_c, @Material_c, @Gender_c, @Measurments_c, @Router_c,
        @Master_Weight_c, @Wax_Piece_c, @Creator_c, @Gross_Weight_c, @Stone_Weight_c,
        @Net_Weight_c, @Stone_Amount_c, @Other_Weight_c, @Other_Amount_c, @Cad_Path_c,
        @Location_c, @Image_URL_c, getdate(), getdate()
      )
    `;

    const request = pool.request();
    Object.entries(jewelryData).forEach(([key, value]) => {
      request.input(key, value);
    });


// Bind the formatted datetime as string
// request.input("CreatedDate", sql.VarChar, createdDate);
// request.input("CreatedDate_c", sql.VarChar, createdDate);

    const result = await request.query(insertQuery);

    const recordId = result.recordset?.[0]?.Id || null;
    console.log("✅ Jewelry Model inserted into SQL, ID:", recordId);

    return {
      success: true,
      recordName: data["Model-name"],
      imageUrl,
    };
  } catch (error) {
    console.error("❌ Error in addJewelryModel:", error);
    throw new Error(`Error in addJewelryModel: ${error.message}`);
  }
}

module.exports = { addJewelryModel };
