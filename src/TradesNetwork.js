import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import playerNames from './player_names.json';  // Assuming player_names.json is in the src folder

const TradesNetwork = ({ data }) => {
    const svgRef = useRef();
    const [filtered, setFiltered] = useState(false);
    const [tradeTypes, setTradeTypes] = useState(['trade']);

    useEffect(() => {
        const { rosters, trades, users } = data;
        console.log(rosters)
        console.log(users)

        // Filter out trades where consenter_ids is null or undefined and only keep complete trades
        let filteredTrades = trades.filter(trade =>
            Array.isArray(trade.consenter_ids) &&
            trade.status === "complete" &&
            tradeTypes.includes(trade.type)
        );

        // Maps to store nodes and links
        const rosterNodesMap = new Map();
        const playerNodesMap = new Map();
        let links = [];

        // Create user nodes
        rosters.forEach((roster, index) => {
            rosterNodesMap.set(roster.roster_id.toString(), {
                id: roster.roster_id.toString(),
                // Find matching user name based on user_id
                label: users.find(user => user.user_id === roster.owner_id)?.display_name || `Team ${index + 1}`,
                type: 'user',
            });
        });

        // Process trades to create player nodes and links
        filteredTrades.forEach(trade => {
            // Create player nodes and connect them to their respective teams
            Object.entries(trade.adds || {}).forEach(([playerId, teamId]) => {
                if (!playerNodesMap.has(playerId)) {
                    const playerName = playerNames[playerId] || `Player ${playerId}`;
                    playerNodesMap.set(playerId, {
                        id: playerId,
                        label: playerName,
                        type: 'player',
                    });
                }
                // Create a link from the player to the team that added them
                links.push({
                    source: playerNodesMap.get(playerId).id,
                    target: teamId.toString(),
                    type: trade.type,
                });
            });

            Object.entries(trade.drops || {}).forEach(([playerId, teamId]) => {
                if (!playerNodesMap.has(playerId)) {
                    const playerName = playerNames[playerId] || `Player ${playerId}`;
                    playerNodesMap.set(playerId, {
                        id: playerId,
                        label: playerName,
                        type: 'player',
                    });
                }
                // Create a link from the team that dropped the player to the player
                links.push({
                    source: teamId.toString(),
                    target: playerNodesMap.get(playerId).id,
                    type: trade.type,
                });
            });

        });

        // Apply filtering based on the toggle
        console.log(filtered)
        // Calculate degree for each node
        const nodeDegrees = new Map();
        links.forEach(link => {
            nodeDegrees.set(link.source, (nodeDegrees.get(link.source) || 0) + 1);
            nodeDegrees.set(link.target, (nodeDegrees.get(link.target) || 0) + 1);
        });

        // Convert Maps to arrays for easier filtering and D3 rendering
        let nodes = [...rosterNodesMap.values(), ...playerNodesMap.values()];
        if (filtered) {
            nodes = nodes.filter(node => nodeDegrees.get(node.id) > 1);
            links = links.filter(link =>
                nodeDegrees.get(link.source) > 1 &&
                nodeDegrees.get(link.target) > 1
            );
        }

        const width = 1600;
        const height = 1600;

        const svg = d3.select(svgRef.current)
            .attr("viewBox", `0 0 ${width} ${height}`)
            .attr("preserveAspectRatio", "xMidYMid meet");

        // Clear any existing elements before drawing new ones
        svg.selectAll("*").remove();

        // Append a group element to hold the graph
        const g = svg.append("g");

        // Apply zoom behavior to the SVG element
        svg.call(d3.zoom()
            .scaleExtent([0.1, 4])  // Limit the zoom scale
            .on("zoom", (event) => {
                g.attr("transform", event.transform);
            })
        );

        const tooltip = d3.select("body")
            .append("div")
            .style("position", "absolute")
            .style("visibility", "hidden")
            .style("padding", "8px")
            .style("background-color", "rgba(0,0,0,0.7)")
            .style("border-radius", "4px")
            .style("color", "#fff")
            .style("font-size", "12px");

        const simulation = d3.forceSimulation(nodes)
            .force("link", d3.forceLink(links).id(d => d.id).distance(100))
            .force("charge", d3.forceManyBody().strength(-300))
            .force("center", d3.forceCenter(width / 2, height / 2))
            .force("collision", d3.forceCollide().radius(d => d.type === 'user' ? 30 : 10))
            .on("tick", ticked);

        const link = g.append("g")
            .selectAll("line")
            .data(links)
            .enter().append("line")
            .attr("stroke-width", 2)
            .attr("stroke", d => {
                switch (d.type) {
                    case 'waiver':
                        return "#FFA500";  // Orange for waiver
                    case 'free_agent':
                        return "#00FF00";  // Green for free agent
                    case 'trade':
                        return "#0000FF";  // Blue for trade
                    default:
                        return "#aaa";  // Default color
                }
            });

        const node = g.append("g")
            .selectAll("g")
            .data(nodes)
            .enter().append("g")
            .call(d3.drag()
                .on("start", dragStarted)
                .on("drag", dragged)
                .on("end", dragEnded));

        node.append("circle")
            .attr("r", d => d.type === 'user' ? 25 : 6)
            .attr("fill", d => d.type === 'user' ? getUserColor(d.id) : "lightblue");

        node.append("text")
            .attr("dy", ".35em")
            .attr("text-anchor", "middle")
            .text(d => d.type === 'user' ? d.label : "")
            .attr("font-size", "10px")
            .attr("fill", "white");

        node.on("mouseover", function (event, d) {
            tooltip.html(d.type === 'user' ? `<strong>Team:</strong> ${d.label}` : `<strong>Player:</strong> ${d.label}`)
                .style("visibility", "visible");

            if (d.type === 'user') {
                // For roster nodes
                const connectedNodes = new Set([d.id]);
                const relevantLinks = new Set();

                // First pass: find directly connected players
                links.forEach(l => {
                    if (l.source.id === d.id && l.target.type === 'player') {
                        connectedNodes.add(l.target.id);
                        relevantLinks.add(l);
                    } else if (l.target.id === d.id && l.source.type === 'player') {
                        connectedNodes.add(l.source.id);
                        relevantLinks.add(l);
                    }
                });

                // Second pass: find rosters connected to these players
                links.forEach(l => {
                    if (connectedNodes.has(l.source.id) && l.target.type === 'user' && l.target.id !== d.id) {
                        connectedNodes.add(l.target.id);
                        relevantLinks.add(l);
                    } else if (connectedNodes.has(l.target.id) && l.source.type === 'user' && l.source.id !== d.id) {
                        connectedNodes.add(l.source.id);
                        relevantLinks.add(l);
                    }
                });

                // Highlight relevant nodes and links
                node.style("opacity", n => connectedNodes.has(n.id) ? 1 : 0.1);
                link.style("opacity", l => relevantLinks.has(l) ? 1 : 0.1);
            } else {
                // For player nodes (unchanged)
                link.style("opacity", l => (l.source.id === d.id || l.target.id === d.id) ? 1 : 0.1);
                node.style("opacity", n => (n.id === d.id || links.some(l =>
                    (l.source.id === d.id && l.target.id === n.id) ||
                    (l.target.id === d.id && l.source.id === n.id)
                )) ? 1 : 0.1);
            }
        })
            .on("mousemove", function (event) {
                tooltip.style("top", (event.pageY - 10) + "px")
                    .style("left", (event.pageX + 10) + "px");
            })
            .on("mouseout", function () {
                tooltip.style("visibility", "hidden");
                link.style("opacity", 1);
                node.style("opacity", 1);
            });

        function ticked() {
            link
                .attr("x1", d => d.source.x)
                .attr("y1", d => d.source.y)
                .attr("x2", d => d.target.x)
                .attr("y2", d => d.target.y);

            node
                .attr("transform", d => `translate(${d.x},${d.y})`);
        }

        function dragStarted(event, d) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
        }

        function dragged(event, d) {
            d.fx = event.x;
            d.fy = event.y;
        }

        function dragEnded(event, d) {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
        }

        function getUserColor(userId) {
            const colorScale = d3.scaleOrdinal(d3.schemeCategory10);
            return colorScale(userId);
        }

        // Clean up tooltip on unmount
        return () => {
            tooltip.remove();
            svg.selectAll("*").remove(); // Clean up the SVG elements on unmount
        };
    }, [data, filtered, tradeTypes]);

    const handleTradeTypeChange = (event) => {
        const value = event.target.value;
        setTradeTypes(prev =>
            prev.includes(value)
                ? prev.filter(type => type !== value)
                : [...prev, value]
        );
    };

    return (
        <div className="trades-network-container">
            <div className="controls">
                <button
                    className={`filter-button ${filtered ? 'active' : ''}`}
                    onClick={() => setFiltered(!filtered)}
                >
                    {filtered ? 'Show All Nodes' : 'Hide Single-Link Nodes'}
                </button>
                <div className="trade-type-selector">
                    <label>
                        <input
                            type="checkbox"
                            value="trade"
                            checked={tradeTypes.includes('trade')}
                            onChange={handleTradeTypeChange}
                        />
                        Trade
                    </label>
                    <label>
                        <input
                            type="checkbox"
                            value="waiver"
                            checked={tradeTypes.includes('waiver')}
                            onChange={handleTradeTypeChange}
                        />
                        Waiver
                    </label>
                    <label>
                        <input
                            type="checkbox"
                            value="free_agent"
                            checked={tradeTypes.includes('free_agent')}
                            onChange={handleTradeTypeChange}
                        />
                        Free Agent
                    </label>
                </div>
            </div>
            <div className="network-visualization">
                <svg ref={svgRef}></svg>
            </div>
        </div>
    );
};

export default TradesNetwork;