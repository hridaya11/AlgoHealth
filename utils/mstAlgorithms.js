// Batch C - Kruskal's Algorithm & Batch B - Prim's Algorithm for Minimum Spanning Tree (MST)

// --- Helper: Disjoint Set Union (DSU) for Kruskal's ---
class DSU {
    constructor(n) {
        this.parent = Array(n + 1).fill(0).map((_, i) => i); // Node IDs might not be 0-indexed
        this.rank = Array(n + 1).fill(0);
        this.nodeMap = new Map(); // Map original node IDs to 0..n-1 index if needed
        this.reverseNodeMap = new Map();
        this.count = 0;
    }

    addNode(nodeId) {
        if (!this.nodeMap.has(nodeId)) {
            const index = this.count++;
            this.nodeMap.set(nodeId, index);
            this.reverseNodeMap.set(index, nodeId);
            // Extend parent/rank arrays if needed (though pre-sizing is better)
            if (index >= this.parent.length) {
                 this.parent[index] = index;
                 this.rank[index] = 0;
            } else {
                 this.parent[index] = index; // Initialize parent to self
            }
        }
    }

    find(nodeId) {
         if (!this.nodeMap.has(nodeId)) return -1; // Node not added
         const i = this.nodeMap.get(nodeId);
         if (this.parent[i] === i) {
            return i;
         }
         // Path compression
         this.parent[i] = this.find(this.reverseNodeMap.get(this.parent[i]));
         return this.parent[i];
    }

    union(nodeId1, nodeId2) {
        const root1 = this.find(nodeId1);
        const root2 = this.find(nodeId2);

        if (root1 !== -1 && root2 !== -1 && root1 !== root2) {
            // Union by rank
            if (this.rank[root1] < this.rank[root2]) {
                this.parent[root1] = root2;
            } else if (this.rank[root1] > this.rank[root2]) {
                this.parent[root2] = root1;
            } else {
                this.parent[root2] = root1;
                this.rank[root1]++;
            }
            return true; // Union successful
        }
        return false; // Nodes already in the same set or invalid
    }
}

// --- Kruskal's Algorithm (Batch C) ---
function kruskalMST(nodes, edges) {
    // nodes: Array of { id, name, ... }
    // edges: Array of { id, nodeAId, nodeBId, cost, ... }

    if (!nodes || nodes.length === 0) return { mstEdges: [], totalCost: 0 };

    // 1. Sort all edges in non-decreasing order of their cost
    const sortedEdges = [...edges].sort((a, b) => a.cost - b.cost);

    // 2. Initialize DSU structure
    const dsu = new DSU(nodes.length);
    nodes.forEach(node => dsu.addNode(node.id));

    const mstEdges = [];
    let totalCost = 0;
    let edgeCount = 0;

    // 3. Iterate through sorted edges
    for (const edge of sortedEdges) {
        // If including this edge does not form a cycle (i.e., nodes are in different sets)
        if (dsu.union(edge.nodeAId, edge.nodeBId)) {
            mstEdges.push(edge); // Add edge to MST
            totalCost += edge.cost;
            edgeCount++;
            // Stop if we have included V-1 edges (where V is number of nodes)
            if (edgeCount === nodes.length - 1) {
                break;
            }
        }
    }

    // Check if MST is possible (all nodes connected)
    if (edgeCount !== nodes.length - 1 && nodes.length > 1) {
         // Check if graph was connected - find root of first node
         const root = dsu.find(nodes[0].id);
         let connected = true;
         for(let i = 1; i < nodes.length; i++) {
              if(dsu.find(nodes[i].id) !== root) {
                   connected = false;
                   break;
              }
         }
         if (!connected) {
            console.warn("Kruskal: Graph is not connected, cannot form MST covering all nodes.");
             // throw new Error("Graph is not connected, cannot form a complete MST.");
             // Or return partial MST found so far
         }
    }


    return { mstEdges, totalCost };
}


// --- Prim's Algorithm (Batch B) ---
// Helper: Basic Priority Queue simulation using an array (can be improved with actual PQ library)
class MinPriorityQueue {
     constructor() { this.elements = []; } // Store [cost, nodeId]
     enqueue(element) { this.elements.push(element); this.elements.sort((a,b) => a[0] - b[0]); } // Sort by cost
     dequeue() { return this.elements.shift(); }
     isEmpty() { return this.elements.length === 0; }
     decreaseKey(nodeId, newCost) { // Simple version: find and update, then re-sort
          const index = this.elements.findIndex(el => el[1] === nodeId);
          if (index > -1 && this.elements[index][0] > newCost) {
               this.elements[index][0] = newCost;
               this.elements.sort((a, b) => a[0] - b[0]);
          }
     }
}

function primMST(nodes, edges) {
    // nodes: Array of { id, name, ... }
    // edges: Array of { id, nodeAId, nodeBId, cost, ... }

     if (!nodes || nodes.length === 0) return { mstEdges: [], totalCost: 0 };

    // 1. Create Adjacency List representation of the graph
    const adj = new Map(); // Map: nodeId -> Array of [neighborId, cost, edgeObject]
    nodes.forEach(node => adj.set(node.id, []));
    edges.forEach(edge => {
        adj.get(edge.nodeAId).push([edge.nodeBId, edge.cost, edge]);
        adj.get(edge.nodeBId).push([edge.nodeAId, edge.cost, edge]); // Undirected graph
    });

    // 2. Initialization
    const startNodeId = nodes[0].id; // Start from the first node arbitrarily
    const visited = new Set();     // Set of nodes included in MST
    const key = new Map();         // Map: nodeId -> minimum edge cost connecting it to MST
    const parentEdge = new Map();  // Map: nodeId -> edge object that connects it to MST parent
    const pq = new MinPriorityQueue(); // Priority Queue: Stores [key[nodeId], nodeId]

    nodes.forEach(node => {
        key.set(node.id, Infinity);
        parentEdge.set(node.id, null);
    });

    key.set(startNodeId, 0);
    pq.enqueue([0, startNodeId]);

    const mstEdges = [];
    let totalCost = 0;

    // 3. Main loop
    while (!pq.isEmpty()) {
        const [currentCost, u] = pq.dequeue(); // Extract node u with minimum key

        // Avoid processing if already visited or cost is outdated (due to simple PQ update)
         if (visited.has(u) || currentCost > key.get(u)) {
             continue;
         }


        visited.add(u);
        totalCost += key.get(u); // Add the cost of the edge connecting u to MST
        if (parentEdge.get(u)) { // Add the edge to the result (skip for start node)
            mstEdges.push(parentEdge.get(u));
        }

        // Explore neighbors v of u
        if (adj.has(u)) {
             for (const [v, cost, edge] of adj.get(u)) {
                 // If v is not in MST and edge cost is smaller than current key[v]
                 if (!visited.has(v) && cost < key.get(v)) {
                     key.set(v, cost);       // Update key of v
                     parentEdge.set(v, edge); // Set edge as parent edge for v
                     pq.enqueue([key.get(v), v]); // Add/Update v in PQ
                     // Note: A real PQ would use decreaseKey, our simple one re-adds/re-sorts
                 }
             }
        }
    }

     // Check if MST is possible (all nodes visited)
     if (visited.size !== nodes.length && nodes.length > 1) {
         console.warn("Prim: Graph is not connected, cannot form MST covering all nodes.");
         // throw new Error("Graph is not connected, cannot form a complete MST.");
         // Or return partial MST found so far
     }


    return { mstEdges, totalCost };
}


module.exports = { kruskalMST, primMST };

