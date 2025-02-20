const fs = require('fs');
const path = require('path');
const prompt = require('prompt-sync')({ sigint: true });

// Path to your drinks JSON file
const DRINKS_FILE = path.join(__dirname, 'data', 'drinks.json');

function loadDrinks() {
  return JSON.parse(fs.readFileSync(DRINKS_FILE, 'utf8'));
}

function saveDrinks(drinks) {
  fs.writeFileSync(DRINKS_FILE, JSON.stringify(drinks, null, 2));
}

function main() {
  console.log("Add drinks to your JSON file. Press Ctrl+C to exit.");
  while (true) {
    const drinks = loadDrinks();
    const name = prompt('Enter drink name: ');
    const image = prompt('Enter image path (relative to your uploads folder): ');

    // Generate a new ID based on the highest existing id
    const newId = drinks.reduce((max, drink) => Math.max(max, drink.id), 0) + 1;

    const newDrink = {
      id: newId,
      name,
      image,
      ratings: []
    };

    drinks.push(newDrink);
    saveDrinks(drinks);
    console.log(`New drink "${name}" added successfully with ID ${newId}`);
    console.log("---------------------------------------------------\n");
  }
}

main();
