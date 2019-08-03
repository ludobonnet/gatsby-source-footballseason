const apifootball = require('./apifootball')

exports.sourceNodes = async (
  { actions, createNodeId, createContentDigest },
  { apiKey, teamId }
) => {
  const { createNode } = actions

  const processNode = ({ type, id, content, parent = null, children = [] }) => {
    const nodeId = createNodeId(`${type}-${id}`)
    const nodeContent = JSON.stringify(content)
    const nodeData = Object.assign({}, content, {
      id: nodeId,
      parent,
      children,
      internal: {
        type,
        content: nodeContent,
        contentDigest: createContentDigest(content),
      },
    })
    return nodeData
  }

  const apiFootball = new apifootball(apiKey)

  try {
    const aNodeCreated = {}

    const leaguesResponse = await apiFootball.leagues()
    const leaguesData = leaguesResponse.data
    // const leaguesData = require('./leaguesworld')
    const leagues = leaguesData.api.leagues

    const fixturesResponse = await apiFootball.fixturesTeam(teamId)
    const fixturesData = fixturesResponse.data
    // const fixturesData = require('./response.json')
    const teamFixtures = fixturesData.api.fixtures

    teamFixtures.map(fixture => {
      delete fixture.referee

      const nodeData = processNode({
        type: `FootMatch`,
        id: fixture.fixture_id,
        content: fixture,
      })

      if (aNodeCreated[fixture.league_id] === undefined) {
        const competition = leagues.find(
          league => league.league_id === fixture.league_id
        )

        const nodeCompetition = processNode({
          type: `FootCompetition`,
          id: competition.league_id,
          content: competition,
        })

        createNode(nodeCompetition)
        aNodeCreated[fixture.league_id] = nodeCompetition.id
      }

      nodeData.competition___NODE = aNodeCreated[fixture.league_id]

      createNode(nodeData)
    })

    const teamLeagues = Object.keys(aNodeCreated)

    const leaguesWithStanding = leagues.filter(league => {
      if (league.standings === 1 && league.is_current === 1) {
        return teamLeagues.find(id => id == league.league_id)
      }
    })

    await Promise.all(
      leaguesWithStanding.map(async league => {
        const standingResponse = await apiFootball.leagueTable(league.league_id)
        const standingData = standingResponse.data
        // const standingData = require('./standing.json')
        const standings = standingData.api.standings
        standings.map(standing => {
          const nodeStanding = processNode({
            type: `FootStanding`,
            id: 'standing' + league.league_id,
            content: { standing },
          })
          nodeStanding.competition___NODE = aNodeCreated[league.league_id]
          createNode(nodeStanding)
        })
      })
    )
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
}
