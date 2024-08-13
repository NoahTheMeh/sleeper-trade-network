import React, { useState, useEffect } from 'react';
import axios from 'axios';

const FetchSleeperData = ({ setData }) => {
    useEffect(() => {
        const fetchData = async () => {
            try {
                const rostersResponse = await axios.get('https://api.sleeper.app/v1/league/1048602803347906560/rosters');
                const usersResponse = await axios.get('https://api.sleeper.app/v1/league/1048602803347906560/users');

                const tradesResponses1 = await Promise.all(
                    Array.from({ length: 11 }, (_, i) => axios.get(`https://api.sleeper.app/v1/league/852010854881812480/transactions/${i + 1}`))
                );
                const tradesResponses2 = await Promise.all(
                    Array.from({ length: 11 }, (_, i) => axios.get(`https://api.sleeper.app/v1/league/916369377795080192/transactions/${i + 1}`))
                );
                const tradesResponses3 = await Promise.all(
                    Array.from({ length: 11 }, (_, i) => axios.get(`https://api.sleeper.app/v1/league/1048602803347906560/transactions/${i + 1}`))
                );

                const tradesResponses = [...tradesResponses1, ...tradesResponses2, ...tradesResponses3];

                const rosters = rostersResponse.data;
                const users = usersResponse.data;
                const trades = tradesResponses.flatMap(response => response.data);

                setData({ rosters, users, trades });
            } catch (error) {
                console.error("Error fetching data:", error);
            }
        };

        fetchData();
    }, [setData]);

    return null;
};

export default FetchSleeperData;
