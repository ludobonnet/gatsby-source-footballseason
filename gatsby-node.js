"use strict";

const apifootball = require('./apifootball');

const colorized = require(`./output-color`);

const packageJson = require('./package.json');

exports.sourceNodes = async ({
  actions,
  cache,
  getNodes,
  createNodeId,
  createContentDigest
}, {
  apiKey,
  teamId
}) => {
  const {
    createNode,
    touchNode
  } = actions;
  const env = process.env.NODE_ENV || 'development';
  let deadlines = 3600000;

  if (env === 'development') {
    deadlines = 86400000;
  }

  const cacheKey = packageJson.name;
  let obj = await cache.get(cacheKey);

  if (obj && Date.now() < obj.created + deadlines) {
    getNodes().filter(n => n.internal.owner === packageJson.name).forEach(n => touchNode({
      nodeId: n.id
    }));
    console.log(colorized.out(`Using Football Season cache ⚠️`, colorized.color.Font.FgYellow));
    return;
  }

  const processNode = ({
    type,
    id,
    content,
    parent = null,
    children = []
  }) => {
    const nodeId = createNodeId(`${type}-${id}`);
    const nodeContent = JSON.stringify(content);
    const nodeData = Object.assign({}, content, {
      id: nodeId,
      parent,
      children,
      internal: {
        type,
        content: nodeContent,
        contentDigest: createContentDigest(content)
      }
    });
    return nodeData;
  };

  console.time(colorized.out(`Fetch API Football data`, colorized.color.Font.FgGreen));
  const apiFootball = new apifootball(apiKey);

  try {
    const aNodeCreated = {};
    let leaguesData = {};
    let fixturesData = {};
    const leaguesResponse = await apiFootball.leagues();
    leaguesData = leaguesResponse.data;
    const fixturesResponse = await apiFootball.fixturesTeam(teamId);
    fixturesData = fixturesResponse.data;
    const leagues = leaguesData.api.leagues;
    const teamFixtures = fixturesData.api.fixtures;
    teamFixtures.map(fixture => {
      delete fixture.referee;
      const nodeData = processNode({
        type: `FootMatch`,
        id: fixture.fixture_id,
        content: fixture
      });

      if (aNodeCreated[fixture.league_id] === undefined) {
        const competition = leagues.find(league => league.league_id === fixture.league_id);
        const nodeCompetition = processNode({
          type: `FootCompetition`,
          id: competition.league_id,
          content: competition
        });
        createNode(nodeCompetition);
        aNodeCreated[fixture.league_id] = nodeCompetition.id;
      }

      nodeData.competition___NODE = aNodeCreated[fixture.league_id];
      createNode(nodeData);
    });
    const teamLeagues = Object.keys(aNodeCreated);
    const leaguesWithStanding = leagues.filter(league => {
      if (league.standings === 1 && league.is_current === 1) {
        return teamLeagues.find(id => id == league.league_id);
      }
    });
    const results = await Promise.all(leaguesWithStanding.map(async league => {
      let standingData = {};
      const standingResponse = await apiFootball.leagueTable(league.league_id);
      standingData = standingResponse.data;
      const standings = standingData.api.standings;
      standings.map(standing => {
        const nodeStanding = processNode({
          type: `FootStanding`,
          id: 'standing' + league.league_id,
          content: {
            standing
          }
        });
        nodeStanding.competition___NODE = aNodeCreated[league.league_id];
        createNode(nodeStanding);
      });
    }));
    obj = {
      created: Date.now()
    };
    await cache.set(cacheKey, obj);
    console.timeEnd(colorized.out(`Fetch API Football data`, colorized.color.Font.FgGreen));
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};