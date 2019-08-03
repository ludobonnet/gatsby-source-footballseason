"use strict";

const axios = require('axios');

class ApiFootball {
  constructor(token) {
    this.instance = axios.create({
      baseURL: 'https://api-football-v1.p.rapidapi.com/v2/',
      headers: {
        'X-RapidAPI-Key': token,
        Accept: 'application/json'
      }
    });
  }

  fixturesTeam(team_id, league_id = null) {
    return league_id === null ? this.instance.get(`/fixtures/team/${team_id}`) : this.instance.get(`/fixtures/team/${team_id}/${league_id}`);
  }

  leagues(league = null, country = null, season = null) {
    if (country && season) {
      return this.instance.get(`/leagues/country/${country}/${season}`);
    } else if (country) {
      return this.instance.get(`/leagues/country/${country}`);
    } else if (season) {
      return this.instance.get(`/leagues/season/${season}`);
    } else if (league) {
      return this.instance.get(`/leagues/league/${league}`);
    } else {
      return this.instance.get(`/leagues`);
    }
  }

  leagueTable(league_id) {
    return this.instance.get(`/leagueTable/${league_id}`);
  }

}

module.exports = ApiFootball;