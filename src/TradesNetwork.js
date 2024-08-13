import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import playerNames from './player_names.json';  // Assuming player_names.json is in the src folder

const TradesNetwork = ({ data }) => {
    const svgRef = useRef();
    const [filtered, setFiltered] = useState(false);
    const [tradeType, setTradeType] = useState("all");



    useEffect(() => {
        const { rosters, trades, users } = data;
        console.log(rosters)
        console.log(users)

        // Filter out trades where consenter_ids is null or undefined and only keep complete trades
        const filteredTrades = trades.filter(trade =>
            Array.isArray(trade.consenter_ids) && trade.status === "complete"
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

        // Process trades to create unique player nodes and links
        filteredTrades.forEach(trade => {
            if (tradeType === "all" || trade.type === tradeType) {
                Object.entries(trade.adds || {}).forEach(([playerId, teamId]) => {
                    // Create a unique node for each player if it doesn't exist
                    if (!playerNodesMap.has(playerId)) {
                        const playerName = playerNames[playerId] || `Player ${playerId}`;
                        playerNodesMap.set(playerId, {
                            id: playerId,
                            label: playerName,
                            type: 'player',
                        });
                    }

                    // Create a link between the team node and the unique player node
                    const teamNodeId = teamId.toString();
                    const playerNode = playerNodesMap.get(playerId);

                    if (rosterNodesMap.has(teamNodeId)) {
                        links.push({
                            source: teamNodeId,
                            target: playerNode.id,
                            type: trade.type  // Store the transaction type (waiver, free_agent, trade)
                        });
                    }
                });
            }
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

        const svg = d3.select(svgRef.current)
            .attr("width", 1600)
            .attr("height", 1600)

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
            .force("center", d3.forceCenter(0, 0))
            .force("collision", d3.forceCollide().radius(20))
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
            .selectAll("circle")
            .data(nodes)
            .enter().append("circle")
            .attr("r", d => d.type === 'user' ? 10 : 6)
            .attr("fill", d => d.type === 'user' ? getUserColor(d.id) : "lightblue")
            .on("mouseover", function (event, d) {
                tooltip.html(d.type === 'user' ? `<strong>Team:</strong> ${d.label}` : `<strong>Player:</strong> ${d.label}`)
                    .style("visibility", "visible");
            })
            .on("mousemove", function (event) {
                tooltip.style("top", (event.pageY - 10) + "px")
                    .style("left", (event.pageX + 10) + "px");
            })
            .on("mouseout", function () {
                tooltip.style("visibility", "hidden");
            })
            .call(d3.drag()
                .on("start", dragStarted)
                .on("drag", dragged)
                .on("end", dragEnded));

        node.append("title")
            .text(d => d.label);

        function ticked() {
            link
                .attr("x1", d => d.source.x)
                .attr("y1", d => d.source.y)
                .attr("x2", d => d.target.x)
                .attr("y2", d => d.target.y);

            node
                .attr("cx", d => d.x)
                .attr("cy", d => d.y);
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
    }, [data, filtered, tradeType]);

    return (
        <div>
            <button onClick={() => setFiltered(!filtered)}>
                Toggle Filter (Remove Nodes with One Link)
            </button>
            <select onChange={(e) => setTradeType(e.target.value)} value={tradeType}>
                <option value="all">All</option>
                <option value="waiver">Waiver</option>
                <option value="free_agent">Free Agent</option>
                <option value="trade">Trade</option>
            </select>
            <svg ref={svgRef}></svg>
        </div>
    );
};

export default TradesNetwork;
