// File: scripts/mcp-agent-test.ts
/**
 * External MCP Agent Test Suite
 * Acts strictly as a remote AI Agent interacting with CAP over HTTP JSON-RPC 2.0.
 * Zero imports of platform source code or direct database access.
 */

const MCP_ENDPOINT = 'http://localhost:3001/mcp';
let requestId = 1;

const HEADERS = {
  'Content-Type': 'application/json',
  'Accept': 'application/json, text/event-stream',
};

function parseSseOrJsonResponse(text: string) {
  if (text.startsWith('event:')) {
    const lines = text.split('\n');
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const jsonStr = line.substring(6).trim();
        return JSON.parse(jsonStr);
      }
    }
  }
  return JSON.parse(text);
}

async function callMCPTool(toolName: string, args: Record<string, unknown>) {
  const payload = {
    jsonrpc: '2.0',
    id: requestId++,
    method: 'tools/call',
    params: {
      name: toolName,
      arguments: args,
    },
  };

  const res = await fetch(MCP_ENDPOINT, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`MCP HTTP Error (${res.status}): ${text}`);
  }

  const text = await res.text();
  const data = parseSseOrJsonResponse(text);

  if (data.error) {
    throw new Error(`MCP Tool Error: ${JSON.stringify(data.error)}`);
  }

  const textContent = data.result?.content?.[0]?.text;
  if (!textContent) {
    return data.result;
  }

  try {
    return JSON.parse(textContent);
  } catch {
    return textContent;
  }
}

async function listMCPTools() {
  const payload = {
    jsonrpc: '2.0',
    id: requestId++,
    method: 'tools/list',
  };

  const res = await fetch(MCP_ENDPOINT, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  const data = parseSseOrJsonResponse(text);
  return data.result?.tools || [];
}

async function runMcpAgentTestSuite() {
  console.log('===========================================================');
  console.log('   STARTING EXTERNAL MCP AGENT END-TO-END TEST SUITE');
  console.log('   Target: POST ' + MCP_ENDPOINT);
  console.log('===========================================================\n');

  // Step 1: Discover Tools
  console.log('[1/12] Discovering MCP Tools...');
  const tools = await listMCPTools();
  console.log(`  ✓ Discovered ${tools.length} MCP tools exposed by CAP.`);

  // Step 2: Create Project
  console.log('\n[2/12] Creating Project via MCP (create_project)...');
  const project = await callMCPTool('create_project', {
    name: 'Autonomous MCP Test Project',
    description: 'E2E Verification project created strictly via MCP Protocol',
  });
  console.log(`  ✓ Project Created! ID: ${project.id}, Name: "${project.name}"`);

  // Step 3: Register Agent
  console.log('\n[3/12] Registering Agent via MCP (register_agent)...');
  const agent = await callMCPTool('register_agent', {
    project_id: project.id,
    name: 'Autonomous-Agent-Alpha',
    type: 'ai_agent',
    role: 'contributor',
    capabilities: 'code, review, testing, mcp',
    status: 'active',
  });
  console.log(`  ✓ Agent Registered! ID: ${agent.id}, Name: "${agent.name}"`);

  // Step 4: List Boards & Default Columns
  console.log('\n[4/12] Listing Project Boards (list_boards)...');
  const boards = await callMCPTool('list_boards', { project_id: project.id });
  const board = boards[0];
  console.log(`  ✓ Board Found: ID: ${board.id}, Name: "${board.name}"`);

  const boardDetails = await callMCPTool('get_board', { board_id: board.id });
  const backlogCol = boardDetails.columns.find((c: any) => c.name === 'Backlog') || boardDetails.columns[0];
  const inProgressCol = boardDetails.columns.find((c: any) => c.name === 'In Progress') || boardDetails.columns[1];
  console.log(`  ✓ Target Columns: Backlog (${backlogCol.id}), In Progress (${inProgressCol.id})`);

  // Step 5: Add Custom Column
  console.log('\n[5/12] Adding Custom Column via MCP (create_column)...');
  const qaColumn = await callMCPTool('create_column', {
    board_id: board.id,
    name: 'QA & Automated Testing',
    wip_limit: 2,
  });
  console.log(`  ✓ Column Added! ID: ${qaColumn.id}, Name: "${qaColumn.name}", WIP Limit: ${qaColumn.wip_limit}`);

  // Step 6: Create Card
  console.log('\n[6/12] Creating Card via MCP (create_card)...');
  const card = await callMCPTool('create_card', {
    column_id: backlogCol.id,
    title: 'Verify Streamable HTTP MCP Integration',
    description: 'Execute automated end-to-end tool calls over MCP JSON-RPC protocol.',
    priority: 'high',
  });
  console.log(`  ✓ Card Created! ID: ${card.id}, Title: "${card.title}"`);

  // Step 7: Assign Agent to Card
  console.log('\n[7/12] Assigning Agent to Card via MCP (assign_card)...');
  const assignedCard = await callMCPTool('assign_card', {
    card_id: card.id,
    agent_id: agent.id,
  });
  console.log(`  ✓ Agent Assigned! Total Assignees: ${assignedCard.assignees.length}`);

  // Step 8: Move Card to In Progress
  console.log('\n[8/12] Moving Card to In Progress via MCP (move_card)...');
  const movedCard = await callMCPTool('move_card', {
    card_id: card.id,
    target_column_id: inProgressCol.id,
  });
  console.log(`  ✓ Card Moved! New Column ID: ${movedCard.column_id}`);

  // Step 9: Add Comment
  console.log('\n[9/12] Logging Execution Comment via MCP (add_comment)...');
  const comment = await callMCPTool('add_comment', {
    card_id: card.id,
    author_id: agent.id,
    content: 'Automated test suite executing. MCP protocol communication verified 100%.',
  });
  console.log(`  ✓ Comment Logged! ID: ${comment.id}`);

  // Step 10: Create & Update Design Document
  console.log('\n[10/12] Authoring Design Doc via MCP (create_document & update_document)...');
  const doc = await callMCPTool('create_document', {
    project_id: project.id,
    title: 'MCP E2E Protocol Specification',
    content: '# MCP E2E Test Spec\n\nInitial draft of automated verification suite.',
    author_id: agent.id,
  });
  console.log(`  ✓ Document Created! ID: ${doc.id}, Version: ${doc.version}, Status: ${doc.status}`);

  const updatedDoc = await callMCPTool('update_document', {
    document_id: doc.id,
    title: 'MCP E2E Protocol Specification (Final)',
    content: '# MCP E2E Test Spec\n\n## Finalized Test Suite\nAll 12 steps executed successfully.',
    change_summary: 'Finalized specification content',
    author_id: agent.id,
  });
  console.log(`  ✓ Document Updated! New Version: ${updatedDoc.version}`);

  // Step 11: Advance Document Status
  console.log('\n[11/12] Advancing Document Workflow Status via MCP (set_document_status)...');
  const inReviewDoc = await callMCPTool('set_document_status', {
    document_id: doc.id,
    status: 'in_review',
  });
  console.log(`  ✓ Status set to: ${inReviewDoc.status}`);

  const approvedDoc = await callMCPTool('set_document_status', {
    document_id: doc.id,
    status: 'approved',
  });
  console.log(`  ✓ Status set to: ${approvedDoc.status}`);

  // Step 12: Get Project Summary & Activity Logs
  console.log('\n[12/12] Fetching Project Summary & Activity via MCP (get_project_summary & get_activity)...');
  const summary = await callMCPTool('get_project_summary', { project_id: project.id });
  const activity = await callMCPTool('get_activity', { project_id: project.id, limit: 10 });

  console.log(`  ✓ Project Summary:`);
  console.log(`      - Boards: ${summary.board_count}`);
  console.log(`      - Cards: ${summary.card_count}`);
  console.log(`      - Registered Agents: ${summary.agent_count}`);
  console.log(`      - Active Agents: ${summary.active_agent_count}`);
  console.log(`      - Design Documents: ${summary.document_count}`);
  console.log(`  ✓ Total Audit Events Recorded: ${activity.length}`);

  console.log('\n===========================================================');
  console.log('   🎉 ALL 12 MCP PROTOCOL TESTS PASSED CLEANLY!');
  console.log('===========================================================\n');
}

runMcpAgentTestSuite().catch((err) => {
  console.error('\n❌ MCP Test Suite Error:', err);
  process.exit(1);
});
