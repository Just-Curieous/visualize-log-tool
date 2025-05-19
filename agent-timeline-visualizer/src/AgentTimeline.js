import React, { useState, useEffect } from 'react';

const AgentTimeline = () => {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [totalDuration, setTotalDuration] = useState(0);
  const [fileContent, setFileContent] = useState('');
  const [filePath, setFilePath] = useState('');

  // Function to parse log content
  const parseLogContent = (content) => {
    // Parse the log systematically
    const lines = content.split('\n');
    console.log('Number of lines in log:', lines.length);
    const events = [];
    
    let currentGlobalStep = null;
    let currentTimestamp = null;
    
    lines.forEach((line, index) => {
      // Extract timestamp from line - updated to match your log format
      const tsMatch = line.match(/(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/);
      if (tsMatch) {
        currentTimestamp = tsMatch[1];
        console.log('Found timestamp:', currentTimestamp); // Debug log
      }
      
      // Extract global step - updated to match your log format
      const globalStepMatch = line.match(/Global Step (\d+)/);
      if (globalStepMatch) {
        currentGlobalStep = parseInt(globalStepMatch[1]);
        console.log('Found global step:', currentGlobalStep); // Debug log
      }
      
      // Extract agent activity - updated to match your log format
      const agentMatch = line.match(/<><><><><> ([^<]+) <><><><><>/);
      if (agentMatch) {
        const agentName = agentMatch[1].trim();
        console.log('Found agent activity:', { agentName, timestamp: currentTimestamp, globalStep: currentGlobalStep });
        
        // Look for tool calls in the next few lines
        let toolCall = null;
        let message = null;
        
        for (let i = 1; i <= 10; i++) {
          if (index + i < lines.length) {
            const nextLine = lines[index + i];
            
            // Check for tool calls - updated to match your log format
            const toolMatch = nextLine.match(/Tool calls?: ([^\n]+)/);
            if (toolMatch && !toolCall) {
              toolCall = toolMatch[1];
            }
            
            // Check for messages or concise responses - updated to match your log format
            const messageMatch = nextLine.match(/Message: (.+)/) || 
                               nextLine.match(/Concise response: (.+)/);
            if (messageMatch && !message) {
              message = messageMatch[1].substring(0, 100) + (messageMatch[1].length > 100 ? '...' : '');
            }
            
            // Stop if we hit another agent or timestamp
            if (nextLine.includes('<><><><><>') || nextLine.match(/\[38;5;240m\d{4}-\d{2}-\d{2}/)) {
              break;
            }
          }
        }
        
        // Only add the event if we have a valid timestamp
        if (currentTimestamp) {
          events.push({
            timestamp: currentTimestamp,
            globalStep: currentGlobalStep,
            agent: agentName,
            toolCall: toolCall,
            message: message,
            lineNumber: index
          });
        }
      }
    });
    
    // Filter events with valid timestamps and convert to Date objects
    const validEvents = events
      .filter(event => event.timestamp)
      .map(event => ({
        ...event,
        date: new Date(event.timestamp.replace(' ', 'T'))
      }))
      .sort((a, b) => a.date - b.date);

    console.log('Number of valid events:', validEvents.length);
    console.log('Sample valid event:', validEvents[0]);

    // Calculate activity durations
    const processedActivities = [];
    for (let i = 0; i < validEvents.length; i++) {
      const current = validEvents[i];
      const next = validEvents[i + 1];
      
      // Calculate duration to next activity (or end of log)
      let durationMinutes = 0;
      if (next) {
        durationMinutes = (next.date - current.date) / (1000 * 60); // Convert to minutes
      } else {
        // For the last activity, assume 1 minute
        durationMinutes = 1;
      }
      
      // Calculate start time relative to first event
      const startMinutes = (current.date - validEvents[0].date) / (1000 * 60);
      
      processedActivities.push({
        ...current,
        startMinutes: Math.max(0, startMinutes),
        durationMinutes: Math.max(0.1, durationMinutes), // Minimum 0.1 minutes for visibility
        endMinutes: Math.max(0.1, startMinutes + durationMinutes)
      });
    }
    
    const totalDur = processedActivities.length > 0 
      ? Math.max(...processedActivities.map(a => a.endMinutes))
      : 0;
    
    console.log('Final processed activities:', processedActivities);
    console.log('Total duration:', totalDur);
    console.log('Number of activities:', processedActivities.length);
    
    setActivities(processedActivities);
    setTotalDuration(totalDur);
    setLoading(false);
  };

  // Handle file path input
  const handleFilePathSubmit = async (event) => {
    event.preventDefault();
    if (filePath) {
      setLoading(true);
      try {
        const response = await fetch(`/api/read-file?path=${encodeURIComponent(filePath)}`);
        if (!response.ok) {
          throw new Error('Failed to read file');
        }
        const content = await response.text();
        setFileContent(content);
        parseLogContent(content);
      } catch (error) {
        console.error('Error reading file:', error);
        alert('Error reading file. Please check the file path and try again.');
        setLoading(false);
      }
    }
  };

  // Handle file input
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      setLoading(true);
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target.result;
        console.log('File content loaded:', content.substring(0, 200) + '...'); // Log first 200 chars
        setFileContent(content);
        parseLogContent(content);
      };
      reader.readAsText(file);
    }
  };

  const agentColors = {
    '👑 SUPERVISOR 👑': '#FF6B6B',
    '👷 CONTROL_WORKER_0 👷': '#4ECDC4',
    '✅ LLM_VERIFIER ✅': '#45B7D1',
    '✅ ANALYZER ✅': '#96CEB4'
  };

  const agentList = [...new Set(activities.map(a => a.agent))];

  // Create time markers (every 5 minutes)
  const timeMarkers = [];
  for (let i = 0; i <= Math.ceil(totalDuration / 5) * 5; i += 5) {
    timeMarkers.push(i);
  }

  const formatDuration = (minutes) => {
    if (minutes < 1) {
      return `${Math.round(minutes * 60)}s`;
    }
    return `${minutes.toFixed(1)}m`;
  };

  const formatTime = (minutes) => {
    const startTime = new Date(`2025-05-19T03:01:14`);
    const currentTime = new Date(startTime.getTime() + minutes * 60000);
    return currentTime.toTimeString().substring(0, 8);
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">Universal Agent Timeline</h1>
      
      {/* File Input Section */}
      <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
        <h2 className="text-xl font-bold mb-4">Input Log File</h2>
        
        {/* File Path Input */}
        <form onSubmit={handleFilePathSubmit} className="mb-6">
          <div className="flex gap-4">
            <input
              type="text"
              value={filePath}
              onChange={(e) => setFilePath(e.target.value)}
              placeholder="Enter file path (e.g., /path/to/paste.txt)"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <button
              type="submit"
              className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              Load File
            </button>
          </div>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300"></div>
          </div>
          <div className="relative flex justify-center">
            <span className="px-4 bg-white text-gray-500 text-sm">OR</span>
          </div>
        </div>

        {/* File Upload */}
        <div className="mt-6 border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
          <input
            type="file"
            accept=".txt,.log"
            onChange={handleFileUpload}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          <p className="mt-2 text-sm text-gray-500">
            Upload your agent log file (paste.txt) to visualize the timeline
          </p>
        </div>
      </div>

      {loading && (
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <p className="mt-2 text-gray-600">Processing log file...</p>
          </div>
        </div>
      )}

      {activities.length > 0 && (
        <>
          {/* Summary */}
          <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
            <h2 className="text-xl font-bold mb-4">Timeline Summary</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{activities.length}</div>
                <div className="text-sm text-gray-600">Total Activities</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{formatDuration(totalDuration)}</div>
                <div className="text-sm text-gray-600">Total Duration</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{agentList.length}</div>
                <div className="text-sm text-gray-600">Active Agents</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {activities.filter(a => a.toolCall).length}
                </div>
                <div className="text-sm text-gray-600">Tool Calls</div>
              </div>
            </div>
          </div>

          {/* Universal Timeline */}
          <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
            <h2 className="text-2xl font-bold mb-4 text-gray-800">Universal Timeline (Gantt Chart)</h2>
            
            {/* Time markers */}
            <div className="relative mb-4">
              <div className="flex justify-between text-xs text-gray-500 border-b border-gray-200 pb-2">
                {timeMarkers.map(minute => (
                  <div key={minute} className="text-center">
                    <div>{formatTime(minute)}</div>
                    <div className="text-gray-400">{minute}m</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Timeline bars */}
            <div className="space-y-1">
              {activities.map((activity, index) => {
                const leftPercent = (activity.startMinutes / totalDuration) * 100;
                const widthPercent = (activity.durationMinutes / totalDuration) * 100;
                
                return (
                  <div key={index} className="relative group">
                    <div
                      className="h-8 rounded-md flex items-center px-2 text-white text-xs font-medium cursor-pointer relative"
                      style={{
                        backgroundColor: agentColors[activity.agent],
                        marginLeft: `${leftPercent}%`,
                        width: `${Math.max(widthPercent, 2)}%`, // Minimum width for visibility
                        minWidth: '60px'
                      }}
                    >
                      <span className="truncate">
                        {activity.agent} - {activity.toolCall || 'Processing'}
                      </span>
                      
                      {/* Tooltip */}
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 bg-gray-800 text-white text-xs rounded py-2 px-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-10">
                        <div className="font-semibold">{activity.agent}</div>
                        <div>Step {activity.globalStep} - {activity.timestamp}</div>
                        <div>Duration: {formatDuration(activity.durationMinutes)}</div>
                        {activity.toolCall && <div>Tool: {activity.toolCall}</div>}
                        {activity.message && <div className="max-w-xs truncate">Message: {activity.message}</div>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Agent Legend */}
          <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
            <h2 className="text-xl font-bold mb-4">Agent Legend</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {agentList.map(agent => {
                const agentActivities = activities.filter(a => a.agent === agent);
                const totalAgentDuration = agentActivities.reduce((sum, a) => sum + a.durationMinutes, 0);
                
                return (
                  <div key={agent} className="flex items-center space-x-3">
                    <div 
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: agentColors[agent] }}
                    ></div>
                    <div>
                      <div className="font-medium text-sm">{agent}</div>
                      <div className="text-xs text-gray-500">
                        {agentActivities.length} activities, {formatDuration(totalAgentDuration)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Detailed Activity List */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-bold mb-4 text-gray-800">Activity Details</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full table-auto">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Time
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Agent
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Duration
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tool/Action
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Step
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Message
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {activities.map((activity, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                        {activity.timestamp}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm">
                        <div className="flex items-center">
                          <div 
                            className="w-3 h-3 rounded-full mr-2"
                            style={{ backgroundColor: agentColors[activity.agent] }}
                          ></div>
                          {activity.agent}
                        </div>
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                        {formatDuration(activity.durationMinutes)}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-900">
                        {activity.toolCall || 'Processing'}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                        {activity.globalStep}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-500 max-w-xs truncate">
                        {activity.message || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Export Options */}
          <div className="mt-8 text-center space-x-4">
            <button 
              onClick={() => {
                const data = JSON.stringify(activities, null, 2);
                const blob = new Blob([data], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'universal_timeline_data.json';
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg font-medium transition-colors"
            >
              Export Timeline Data
            </button>
            
            <button 
              onClick={() => {
                // Create CSV data
                const csvData = [
                  ['Timestamp', 'Agent', 'Duration (minutes)', 'Tool/Action', 'Global Step', 'Message'],
                  ...activities.map(a => [
                    a.timestamp,
                    a.agent,
                    a.durationMinutes.toFixed(2),
                    a.toolCall || 'Processing',
                    a.globalStep,
                    a.message || ''
                  ])
                ];
                
                const csv = csvData.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
                const blob = new Blob([csv], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'universal_timeline.csv';
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded-lg font-medium transition-colors"
            >
              Export as CSV
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default AgentTimeline;
