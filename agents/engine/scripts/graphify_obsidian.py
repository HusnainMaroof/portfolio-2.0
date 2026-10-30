"""Turn a Graphify graph.json into Obsidian notes (one per code node + one per community).

usage: python -I graphify_obsidian.py <graph.json> <output dir>
"""
import json
import sys
from collections import defaultdict

import networkx as nx
from graphify.export import to_obsidian

graph_file, out_dir = sys.argv[1], sys.argv[2]
data = json.load(open(graph_file, encoding="utf-8"))
G = nx.node_link_graph(data, edges="links")
communities = defaultdict(list)
labels = {}
for node, attrs in G.nodes(data=True):
    c = attrs.get("community")
    if c is None:
        continue
    communities[c].append(node)
    if attrs.get("community_name"):
        labels[c] = attrs["community_name"]
print(to_obsidian(G, dict(communities), out_dir, community_labels=labels or None))
