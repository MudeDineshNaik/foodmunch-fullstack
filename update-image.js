const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");

async function updateBiryaniImage() {
    const db = await open({
        filename: path.join(__dirname, "data", "foodmunch.db"),
        driver: sqlite3.Database
    });

    await db.run(
        "UPDATE foods SET image = ? WHERE name = ?",
        [
            "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQTtWQFgd3t1sPPSxlnk-0TT5KOM6GnliFxVKqudAMSTA&s=10",
            "Hyderabadi Biryani"
        ]
    );

    const food = await db.get(
        "SELECT name, image FROM foods WHERE name = ?",
        ["Hyderabadi Biryani"]
    );

    console.log("Updated food:", food);
    await db.close();
}

updateBiryaniImage().catch(console.error);