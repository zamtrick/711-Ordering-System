import mongoose from "mongoose";
import dotenv from "dotenv";
import Category from "../models/Category.js";
import Product from "../models/Product.js";

dotenv.config();

// --------------------------------------------------
// SAMPLE CATEGORIES
// Categories are created only if they don't already
// exist, so this script is safe to run on a DB that
// already has categories (e.g. created via the admin).
// --------------------------------------------------

const CATEGORIES = [
  { name: "Coffee", description: "City Cafe and Gulp coffee drinks." },
  { name: "Drinks", description: "Chilled beverages and gulps." },
  { name: "Bakery", description: "Bread, donuts and pastries from the bakery section." },
  { name: "Hot Meals", description: "Siopao, hotdogs and rice meals from the hot food counter." },
];

// --------------------------------------------------
// SAMPLE PRODUCTS
// Fields: sku, name, category (matched against CATEGORIES), price, description
// --------------------------------------------------

const PRODUCTS = [
  {
    sku: "CC-FV-S",
    name: "City Cafe French Vanilla Small",
    category: "Coffee",
    price: 41.0,
    description: "Hot French vanilla-flavored coffee, small cup.",
  },
  {
    sku: "CC-HC-S",
    name: "City Cafe Signature Hot Chocolate Drink Small",
    category: "Coffee",
    price: 39.0,
    description: "Rich signature hot chocolate, small cup.",
  },
  {
    sku: "CC-IC-M",
    name: "Gulp Iced Coffee Medium",
    category: "Coffee",
    price: 50.0,
    description: "Chilled iced coffee, medium cup.",
  },
  {
    sku: "GLP-MILO-R",
    name: "Gulp Milo Regular",
    category: "Drinks",
    price: 43.0,
    description: "Chocolate malt drink over ice, regular cup.",
  },
  {
    sku: "GLP-RIT-R",
    name: "Gulp Red Iced Tea Regular",
    category: "Drinks",
    price: 33.0,
    description: "Refreshing red iced tea, regular cup.",
  },
  {
    sku: "MD-CB-SMIDGET",
    name: "MD Choco Butternut Smidget",
    category: "Bakery",
    price: 13.0,
    description: "Bite-size choco butternut pastry.",
  },
  {
    sku: "MD-CB-DONUT",
    name: "MD Choco Butternut Cake Donut",
    category: "Bakery",
    price: 47.0,
    description: "Cake donut with choco butternut flavor.",
  },
  {
    sku: "SF-SIOPAO-ASADO-B",
    name: "7-Fresh Siopao Budget Asado",
    category: "Hot Meals",
    price: 46.0,
    description: "Steamed siopao filled with asado, budget size.",
  },
  {
    sku: "SF-SIOPAO-BOLA-B",
    name: "7 Fresh Siopao Budget Bola Bola",
    category: "Hot Meals",
    price: 46.0,
    description: "Steamed siopao filled with bola-bola, budget size.",
  },
  {
    sku: "SF-SIOPAO-ASADO-P",
    name: "7-Fresh Siopao Chicken Premium Asado",
    category: "Hot Meals",
    price: 61.0,
    description: "Premium steamed siopao with chicken asado filling.",
  },
  {
    sku: "SF-SIOPAO-BOLA-P",
    name: "7-Fresh Siopao Chicken Premium Bola-Bola",
    category: "Hot Meals",
    price: 61.0,
    description: "Premium steamed siopao with chicken bola-bola filling.",
  },
  {
    sku: "BB-HUNGRY-CHEESE",
    name: "Big Bite Hotdog Cheese Hungarian",
    category: "Hot Meals",
    price: 50.0,
    description: "Cheese-topped Hungarian hotdog on a bun.",
  },
  {
    sku: "BB-CREAMY-CHEESE",
    name: "Big Bite Hotdog Creamy Cheese",
    category: "Hot Meals",
    price: 50.0,
    description: "Hotdog on a bun topped with creamy cheese sauce.",
  },
  {
    sku: "BB-JUNIOR",
    name: "Big Bite Junior",
    category: "Hot Meals",
    price: 43.0,
    description: "Classic junior-size hotdog on a bun.",
  },
  {
    sku: "TJ-CLASSIC-PF",
    name: "TJ Classic (Pork Free)",
    category: "Hot Meals",
    price: 50.0,
    description: "Pork-free classic hotdog sandwich.",
  },
  {
    sku: "ICH-WHITE-600",
    name: "Ichipan White Loaf 600g",
    category: "Bakery",
    price: 117.0,
    description: "Soft white loaf bread, 600g.",
  },
  {
    sku: "ICH-WW-380",
    name: "Ichipan Whole Wheat Loaf 380g",
    category: "Bakery",
    price: 91.0,
    description: "Whole wheat loaf bread, 380g.",
  },
  {
    sku: "ICH-WW-600",
    name: "Ichipan Whole Wheat Loaf 600g",
    category: "Bakery",
    price: 144.0,
    description: "Whole wheat loaf bread, 600g.",
  },
  {
    sku: "HT-LECHON-PAKSIW",
    name: "Hottarice Lechon Paksiw Meal",
    category: "Hot Meals",
    price: 105.0,
    description: "Steamed rice with lechon paksiw.",
  },
  {
    sku: "HT-LIEMPO",
    name: "Hottarice Liempo Meal",
    category: "Hot Meals",
    price: 105.0,
    description: "Steamed rice with grilled liempo.",
  },
];

// --------------------------------------------------
// Helpers
// --------------------------------------------------

// Deterministic EAN-13 barcode with a valid check digit
// (prefix 480 = Philippines) so sample barcodes are unique.
function makeBarcode(index) {
  const base = `4800000${String(index).padStart(3, "0")}`; // 10 digits
  const digits = [...base].map(Number);
  const check =
    (10 - ((digits.reduce((sum, d, i) => sum + d * (i % 2 === 0 ? 1 : 3), 0)) % 10)) %
    10;
  return base + check;
}

async function seed() {
  try {
    await mongoose.connect(process.env.DB_URI);
    console.log("Connected to MongoDB\n");

    // 1. Categories (find or create)
    const categoryIds = {};
    for (const cat of CATEGORIES) {
      let category = await Category.findOne({ name: cat.name });
      if (!category) {
        category = await Category.create({ ...cat, isActive: true });
        console.log(`+ Category created: ${cat.name}`);
      } else {
        console.log(`= Category already exists: ${cat.name}`);
      }
      categoryIds[cat.name] = category._id;
    }

    // 2. Products (find or create/update by SKU)
    let created = 0;
    let updated = 0;
    for (let i = 0; i < PRODUCTS.length; i++) {
      const p = PRODUCTS[i];
      const data = {
        name: p.name,
        barcode: makeBarcode(i + 1),
        description: p.description,
        categoryId: categoryIds[p.category],
        price: p.price,
        stock: 100,
        isActive: true,
      };

      const existing = await Product.findOne({ sku: p.sku });
      if (existing) {
        await Product.updateOne({ sku: p.sku }, { $set: data });
        updated++;
        console.log(`= Product updated: ${p.name} (${p.sku})`);
      } else {
        await Product.create({ sku: p.sku, ...data });
        created++;
        console.log(`+ Product created: ${p.name} (${p.sku})`);
      }
    }

    console.log(`\nDone! ${created} created, ${updated} already existed/updated.`);
  } catch (error) {
    console.error(error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

seed();
