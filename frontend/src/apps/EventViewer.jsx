import { useState, useEffect } from 'react';
import { Download, RefreshCw, Trash2 } from 'lucide-react';
import '../styles/apps/event-viewer.css';

const EventViewerApp = () => {
  const [events, setEvents] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [filters, setFilters] = useState({
    level: '',
    category: '',
    source: '',
  });
  const [availableFilters, setAvailableFilters] = useState({
    levels: [],
    categories: [],
    sources: [],
  });
  const [page, setPage] = useState(0);
  const pageSize = 50;

  // Fetch available filter options
  useEffect(() => {
    const fetchFilters = async () => {
      try {
        const [levelsRes, categoriesRes, sourcesRes] = await Promise.all([
          fetch('http://localhost:8000/events/levels'),
          fetch('http://localhost:8000/events/categories'),
          fetch('http://localhost:8000/events/sources'),
        ]);

        const levels = await levelsRes.json();
        const categories = await categoriesRes.json();
        const sources = await sourcesRes.json();

        setAvailableFilters({
          levels: levels.levels || [],
          categories: categories.categories || [],
          sources: sources.sources || [],
        });
      } catch (error) {
        console.error('Failed to fetch filter options:', error);
      }
    };

    fetchFilters();
  }, []);

  // Fetch events
  useEffect(() => {
    const fetchEvents = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (filters.level) params.append('level', filters.level);
        if (filters.category) params.append('category', filters.category);
        if (filters.source) params.append('source', filters.source);
        params.append('limit', pageSize.toString());
        params.append('offset', (page * pageSize).toString());

        const response = await fetch(`http://localhost:8000/events/?${params}`);
        const data = await response.json();

        setEvents(data.events || []);
        setTotal(data.total || 0);
      } catch (error) {
        console.error('Failed to fetch events:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, [filters, page]);

  const handleFilterChange = (filterType, value) => {
    setFilters(prev => ({
      ...prev,
      [filterType]: value,
    }));
    setPage(0); // Reset to first page when filter changes
  };

  const handleRefresh = () => {
    setPage(0);
    setFilters({ level: '', category: '', source: '' });
  };

  const handleExport = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.level) params.append('level', filters.level);
      if (filters.category) params.append('category', filters.category);
      if (filters.source) params.append('source', filters.source);

      const response = await fetch(`http://localhost:8000/events/export?${params}`);
      const csvContent = await response.text();

      // Create download link
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `jezos_events_${new Date().toISOString()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export events:', error);
      alert('Failed to export events');
    }
  };

  const handleClearOld = async () => {
    if (!window.confirm('This will delete events older than 30 days. Continue?')) {
      return;
    }

    try {
      const response = await fetch('http://localhost:8000/events/clear', {
        method: 'DELETE',
      });
      const data = await response.json();
      alert(`Successfully deleted ${data.deleted} old events`);
      handleRefresh();
    } catch (error) {
      console.error('Failed to clear events:', error);
      alert('Failed to clear old events');
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm('This will DELETE ALL EVENTS. This cannot be undone. Continue?')) {
      return;
    }

    try {
      const response = await fetch('http://localhost:8000/events/clear-all', {
        method: 'DELETE',
      });
      const data = await response.json();
      alert(`Successfully deleted all ${data.deleted} events`);
      handleRefresh();
    } catch (error) {
      console.error('Failed to clear all events:', error);
      alert('Failed to clear all events');
    }
  };

  const getLevelIcon = (level) => {
    switch (level) {
      case 'Critical':
        return '🔴';
      case 'Error':
        return '❌';
      case 'Warning':
        return '⚠️';
      case 'Information':
        return 'ℹ️';
      case 'Verbose':
        return '📝';
      default:
        return '•';
    }
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="event-viewer">
      {/* Toolbar */}
      <div className="event-viewer-toolbar">
        <div className="toolbar-filters">
          <select
            value={filters.level}
            onChange={(e) => handleFilterChange('level', e.target.value)}
            className="filter-select"
          >
            <option value="">All Levels</option>
            {availableFilters.levels.map(level => (
              <option key={level} value={level}>{level}</option>
            ))}
          </select>

          <select
            value={filters.category}
            onChange={(e) => handleFilterChange('category', e.target.value)}
            className="filter-select"
          >
            <option value="">All Categories</option>
            {availableFilters.categories.map(category => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>

          <select
            value={filters.source}
            onChange={(e) => handleFilterChange('source', e.target.value)}
            className="filter-select"
          >
            <option value="">All Sources</option>
            {availableFilters.sources.map(source => (
              <option key={source} value={source}>{source}</option>
            ))}
          </select>
        </div>

        <div className="toolbar-actions">
          <button onClick={handleRefresh} className="toolbar-btn toolbar-btn-refresh">
            <RefreshCw className="toolbar-btn-icon" size={14} strokeWidth={3.2} aria-hidden="true" />
            <span>Refresh</span>
          </button>
          <button onClick={handleExport} className="toolbar-btn toolbar-btn-export">
            <Download className="toolbar-btn-icon" size={14} strokeWidth={3.2} aria-hidden="true" />
            <span>Export</span>
          </button>
          <button onClick={handleClearOld} className="toolbar-btn toolbar-btn-clear">
            <Trash2 className="toolbar-btn-icon" size={14} strokeWidth={3.2} aria-hidden="true" />
            <span>Clear Old</span>
          </button>
          <button onClick={handleClearAll} className="toolbar-btn toolbar-btn-danger">
            <Trash2 className="toolbar-btn-icon" size={14} strokeWidth={3.2} aria-hidden="true" />
            <span>Clear All</span>
          </button>
        </div>
      </div>

      {/* Event List */}
      <div className="event-viewer-content">
        <div className="event-list">
          {loading ? (
            <div className="event-loading">Loading events...</div>
          ) : events.length === 0 ? (
            <div className="event-empty">No events found</div>
          ) : (
            <>
              <table className="event-table">
                <thead>
                  <tr>
                    <th>Level</th>
                    <th>Time</th>
                    <th>Category</th>
                    <th>Source</th>
                    <th>Event ID</th>
                    <th>Message</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((event) => (
                    <tr
                      key={event.id}
                      onClick={() => setSelectedEvent(event)}
                      className={`event-row event-level-${event.level.toLowerCase()} ${
                        selectedEvent?.id === event.id ? 'selected' : ''
                      }`}
                    >
                      <td className="event-level">
                        {event.level}
                      </td>
                      <td className="event-time">{formatTimestamp(event.timestamp)}</td>
                      <td className="event-category">{event.category}</td>
                      <td className="event-source">{event.source}</td>
                      <td className="event-id">{event.event_id}</td>
                      <td className="event-message">{event.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              <div className="event-pagination">
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="page-btn"
                >
                  ◀ Previous
                </button>
                <span className="page-info">
                  Page {page + 1} of {totalPages} ({total} events)
                </span>
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={page >= totalPages - 1}
                  className="page-btn"
                >
                  Next ▶
                </button>
              </div>
            </>
          )}
        </div>

        {/* Event Details Panel */}
        {selectedEvent && (
          <div className="event-details">
            <div className="details-header">
              <h3>Event Details</h3>
              <button
                onClick={() => setSelectedEvent(null)}
                className="close-btn"
              >
                ✕
              </button>
            </div>
            <div className="details-content">
              <div className="detail-row">
                <span className="detail-label">Level:</span>
                <span className="detail-value">
                  {selectedEvent.level}
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Timestamp:</span>
                <span className="detail-value">{formatTimestamp(selectedEvent.timestamp)}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Category:</span>
                <span className="detail-value">{selectedEvent.category}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Source:</span>
                <span className="detail-value">{selectedEvent.source}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Event ID:</span>
                <span className="detail-value">{selectedEvent.event_id}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Message:</span>
                <span className="detail-value">{selectedEvent.message}</span>
              </div>
              {selectedEvent.username && (
                <div className="detail-row">
                  <span className="detail-label">Username:</span>
                  <span className="detail-value">{selectedEvent.username}</span>
                </div>
              )}
              <div className="detail-row detail-row-details">
                <span className="detail-label">Details:</span>
                {selectedEvent.details ? (
                  <pre className="detail-value detail-json">
                    {JSON.stringify(selectedEvent.details, null, 2)}
                  </pre>
                ) : (
                  <div className="detail-value detail-json detail-json-empty" />
                )}
              </div>
              {selectedEvent.stack_trace && (
                <div className="detail-row detail-row-details">
                  <span className="detail-label">Stack Trace:</span>
                  <pre className="detail-value detail-json">
                    {selectedEvent.stack_trace}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EventViewerApp;
