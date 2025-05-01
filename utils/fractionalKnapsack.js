// Batch D - Fractional Knapsack Problem
// Goal: Maximize total value of items carried within a weight capacity (budget). Fractions of items are allowed.

function fractionalKnapsack(items, capacity) {
    // items: Array of objects [{ id, name, cost (weight), value }, ...]
    // capacity: Maximum total cost (budget) allowed

    // 1. Calculate value-to-cost ratio for each item
    items.forEach(item => {
        item.ratio = item.cost > 0 ? item.value / item.cost : 0; // Avoid division by zero
    });

    // 2. Sort items in descending order of their value-to-cost ratio
    items.sort((a, b) => b.ratio - a.ratio);

    let currentCost = 0;
    let totalValue = 0;
    const allocation = []; // Stores the result: [{ name, cost, value, fractionTaken, costTaken, valueTaken }]

    // 3. Iterate through sorted items and add them to the knapsack
    for (const item of items) {
        if (currentCost + item.cost <= capacity) {
            // Take the whole item
            currentCost += item.cost;
            totalValue += item.value;
            allocation.push({
                ...item, // include original details
                fractionTaken: 1,
                costTaken: item.cost,
                valueTaken: item.value
            });
        } else {
            // Take a fraction of the item
            const remainingCapacity = capacity - currentCost;
            if (remainingCapacity > 0 && item.cost > 0) {
                 const fraction = remainingCapacity / item.cost;
                 currentCost += remainingCapacity; // Knapsack is now full
                 totalValue += item.value * fraction;
                 allocation.push({
                     ...item,
                     fractionTaken: fraction,
                     costTaken: remainingCapacity, // cost of the fraction taken
                     valueTaken: item.value * fraction // value of the fraction taken
                 });
            }
            break; // Knapsack is full, no need to check further items
        }
    }

    return {
        allocation: allocation,
        totalValue: totalValue,
        totalCost: currentCost // Should be <= capacity
    };
}

module.exports = { fractionalKnapsack };

