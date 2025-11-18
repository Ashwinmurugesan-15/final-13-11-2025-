// Global variables
let tableData = [];
let originalTableData = []; // Store original unfiltered data
let tableColumns = [];
let groupChart = null;
let distributionChart = null;
let dropdownOptions = {};
let currentIsAdmin = false; // Store admin status for filtering

function updateAdminControls(isAdmin) {
    const addCandidateBtn = document.getElementById('addCandidateBtn');
    if (addCandidateBtn) {
        addCandidateBtn.style.display = isAdmin ? 'inline-block' : 'none';
    }
}

// Desired field order for candidate management UI
const FIELD_ORDER = [
    'Date', 'Name', 'Email ID', 'Contact Number', 'Interested Position', 'Current Role',
    'Current Organization', 'Current Location', 'Current CTC per Annum',
    'Expected CTC per Annum', 'Total Years of Experience', 'Notice Period',
    'Comments',
    'In Notice', 'Immediate Joiner', 'Offers in Hand', 'Offered CTC',
    'Location Preference', 'Certifications', 'Resume', 'LinkedIn Profile', 'Referred By', 'Interview Status', 'Application Status',
    // Stage-specific remarks captured separately in forms/details
    'Initial Screening', 'Round 1 Remarks', 'Round 2 Remarks', 'Final Remarks',
    // General/legacy remarks
    'Remarks', 'Reject Mail Sent', 'Month Count',
];

// Predefined dropdown options
const PREDEFINED_DROPDOWNS = {
    'Interview Status': [
        'Applied',
        'Profile Screening Comp',
        'Voice Screening Comp',
        'Tech Inter Sched',
        'Tech Inter Comp',
        'Code Inter Sched',
        'Code Inter Comp',
        'HR Inter Sched',
        'HR Inter Comp',
        'Offer',
        'Pending Final Noti',
        'References',
        'All Completed'
    ],
    'Application Status': [
        'Proceed Further',
        'On Hold',
        'No Resp Call/Email',
        'Did Not Join',
        'Sent',
        'Recieved',
        'In Notice',
        'Accepted',
        'Rejected',
        'Joined'
    ],
    'Reject Mail Sent': ['Yes', 'No']
};

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    // Only fetch analytics data if on the analytics page
    if (window.location.pathname === '/analytics') {
        fetchAnalyticsData();
    }
    // Load dropdown options first
    fetchDropdownOptions().then(() => {
        populateStatusFilterOptions();
        // Then load data
        fetchData();
    });
    
    // Set up event listeners
    const saveBtn = document.getElementById('saveDataBtn');
    const updateBtn = document.getElementById('updateDataBtn');
    const positionFilter = document.getElementById('positionFilter');
    const statusFilter = document.getElementById('statusFilter');
    
    if (saveBtn) saveBtn.addEventListener('click', saveNewRecord);
    if (updateBtn) updateBtn.addEventListener('click', updateRecord);
    if (positionFilter) positionFilter.addEventListener('change', applyTableFilters);
    if (statusFilter) statusFilter.addEventListener('change', applyTableFilters);
    
    // Update sticky column positions on window resize
    let resizeTimeout;
    window.addEventListener('resize', function() {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            updateStickyColumnPositions();
        }, 100);
    });
    
    // Set up tab navigation (only for links that target tabs)
    document.querySelectorAll('.nav-link[data-bs-target]').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const tabId = this.getAttribute('data-bs-target');
            if (!tabId) {
                return;
            }
            
            // Hide all tab panes
            document.querySelectorAll('.tab-pane').forEach(pane => {
                pane.classList.remove('show', 'active');
            });
            
            // Show the selected tab pane
            const targetPane = document.querySelector(tabId);
            if (targetPane) {
                targetPane.classList.add('show', 'active');
            }
            
            // Update active state on nav links
            document.querySelectorAll('.nav-link[data-bs-target]').forEach(navLink => {
                navLink.classList.remove('active');
            });
            this.classList.add('active');
            
            // Load analysis data when switching to analysis tab
            if (tabId === '#analysisTab') {
                // Summary removed: skip fetchSummary()
                // Update all analytics charts when switching to analytics tab
                if (tableData && tableData.length > 0) {
                    updateMonthlyStats(tableData);
                    updateApplicationStatusChart(tableData);
                    // updatePositionChart(tableData); // Removed
                    updateCurrentLocationChart(tableData);
                    updateCTCComparisonChart(tableData);
                }
            }
        });
    });
});

// Update distribution chart for numeric fields
function updateDistributionChart() {
    const numericColumns = ['Current CTC per Annum', 'Expected CTC per Annum', 'Offered CTC'];
    let selectedColumn = null;
    
    for (const column of numericColumns) {
        if (tableColumns.includes(column)) {
            selectedColumn = column;
            break;
        }
    }
    
    if (!selectedColumn || tableData.length === 0) {
        document.getElementById('distributionChartContainer').innerHTML = 
            '<div class="alert alert-info">No numeric data available for distribution analysis</div>';
        return;
    }
    
    const values = tableData
        .map(item => parseFloat(item[selectedColumn]))
        .filter(value => !isNaN(value));
    
    if (values.length === 0) {
        document.getElementById('distributionChartContainer').innerHTML = 
            '<div class="alert alert-info">No valid numeric data available for distribution analysis</div>';
        return;
    }
    
    const min = Math.min(...values);
    const max = Math.max(...values);
    const binCount = Math.min(10, values.length);
    const binSize = (max - min) / binCount;
    
    const bins = Array(binCount).fill(0);
    values.forEach(value => {
        const binIndex = Math.min(Math.floor((value - min) / binSize), binCount - 1);
        bins[binIndex]++;
    });
    
    const binLabels = Array(binCount).fill(0).map((_, i) => {
        const start = min + i * binSize;
        const end = min + (i + 1) * binSize;
        return `${start.toFixed(1)}-${end.toFixed(1)}`;
    });
    
    const distCanvas = document.getElementById('distributionChart');
    if (!distCanvas) {
        const container = document.getElementById('distributionChartContainer');
        if (container) {
            container.innerHTML = '<div class="alert alert-warning">Distribution chart is unavailable.</div>';
        }
        return;
    }
    const ctx = distCanvas.getContext('2d');
    
    if (distributionChart) {
        distributionChart.destroy();
    }
    
    distributionChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: binLabels,
            datasets: [{
                label: `Distribution of ${selectedColumn}`,
                data: bins,
                backgroundColor: 'rgba(54, 162, 235, 0.6)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: `Distribution of ${selectedColumn}`
                },
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Frequency'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: selectedColumn
                    }
                }
            }
        }
    });
}



// Function to show candidate details (vertical layout only)
function showCandidateDetails(candidate) {
    const modalContent = document.getElementById('candidateDetailContent');
    modalContent.innerHTML = '';
    
    // Render grouped stage remarks as cards at the top
    const remarksSection = document.createElement('div');
    remarksSection.className = 'mb-4';
    const remarksHeader = document.createElement('div');
    remarksHeader.className = 'fw-bold mb-2';
    remarksHeader.textContent = 'Remarks';
    remarksSection.appendChild(remarksHeader);

    const row = document.createElement('div');
    row.className = 'row g-3';

    const stages = [
        { key: 'Initial Screening', title: 'Initial Screening', color: 'primary' },
        { key: 'Round 1 Remarks', title: 'Round 1', color: 'success' },
        { key: 'Round 2 Remarks', title: 'Round 2', color: 'warning' }
    ];

    stages.forEach(stage => {
        const col = document.createElement('div');
        col.className = 'col-md-4';

        const card = document.createElement('div');
        card.className = `p-3 rounded border bg-${stage.color} bg-opacity-10`;

        const title = document.createElement('div');
        title.className = `fw-semibold mb-2 text-${stage.color}`;
        title.textContent = stage.title;

        const content = document.createElement('div');
        content.className = 'candidate-detail-value';
        const text = candidate[stage.key] || '';
        content.textContent = text;

        card.appendChild(title);
        card.appendChild(content);
        col.appendChild(card);
        row.appendChild(col);
    });

    remarksSection.appendChild(row);
    modalContent.appendChild(remarksSection);
    
    // Use FIELD_ORDER to display fields in the specified order (skip remarks fields already shown)
    FIELD_ORDER.forEach(field => {
        if (field === 'Initial Screening' || field === 'Round 1 Remarks' || field === 'Round 2 Remarks' || field === 'Remarks') {
            return; // skip
        }
        if (candidate.hasOwnProperty(field) && candidate[field] !== null && candidate[field] !== '') {
            const detailItem = document.createElement('div');
            detailItem.className = 'mb-3';
            
            const label = document.createElement('div');
            label.className = 'text-muted small fw-semibold mb-1';
            label.textContent = field === 'Date' ? 'Date:' : field + ':';
            
            const value = document.createElement('div');
            value.className = 'candidate-detail-value';
            
            // Special handling for specific fields
            if (field === 'Resume' && candidate[field]) {
                value.innerHTML = `<a href="${candidate[field]}" target="_blank" class="btn btn-outline-primary btn-sm">
                    <i class="bi bi-file-earmark-pdf me-1"></i>View Resume
                </a>`;
            } else if (field === 'LinkedIn Profile' && candidate[field]) {
                value.innerHTML = `<a href="${candidate[field]}" target="_blank" class="btn btn-outline-primary btn-sm">
                    <i class="bi bi-linkedin me-1"></i>View LinkedIn
                </a>`;
            } else if (field === 'Interview Status' || field === 'Application Status') {
                const badgeClass = getStatusBadgeClass(candidate[field]);
                value.innerHTML = `<span class="badge ${badgeClass}">${candidate[field]}</span>`;
            } else if (field === 'Timestamp' && candidate[field]) {
                // Format timestamp to show only date
                const date = new Date(candidate[field]);
                value.textContent = date.toLocaleDateString();
            } else {
                value.textContent = field === 'Date' && candidate[field] ? new Date(candidate[field]).toLocaleDateString() : candidate[field];
            }
            
            detailItem.appendChild(label);
            detailItem.appendChild(value);
            modalContent.appendChild(detailItem);
        }
    });
    
    // Display any remaining fields not in FIELD_ORDER
    const remainingFields = Object.keys(candidate).filter(field => !FIELD_ORDER.includes(field));
    remainingFields.forEach(field => {
        if (candidate.hasOwnProperty(field) && candidate[field] !== null && candidate[field] !== '') {
            const detailItem = document.createElement('div');
            detailItem.className = 'mb-3';
            
            const label = document.createElement('div');
            label.className = 'text-muted small fw-semibold mb-1';
            label.textContent = field === 'Timestamp' ? 'Date:' : field + ':';
            
            const value = document.createElement('div');
            value.className = 'candidate-detail-value';
            // Ensure Date shows only date in remaining fields as well
if (field === 'Timestamp' && candidate[field]) {
                const date = new Date(candidate[field]);
                value.textContent = date.toLocaleDateString();
            } else {
                value.textContent = candidate[field];
            }
            
            detailItem.appendChild(label);
            detailItem.appendChild(value);
            modalContent.appendChild(detailItem);
        }
    });
    
    // Show the modal
    const modal = new bootstrap.Modal(document.getElementById('candidateDetailModal'));
    modal.show();
}





// Function to get status badge class
function getStatusBadgeClass(status) {
    switch(status) {
        case 'Active': return 'bg-success';
        case 'Inactive': return 'bg-secondary';
        case 'Pending': return 'bg-warning';
        case 'Rejected': return 'bg-danger';
        case 'Selected': return 'bg-info';
        default: return 'bg-primary';
    }
}

// Function to fetch dropdown options from the server
async function fetchDropdownOptions() {
    try {
        const response = await fetch('/api/dropdown-options');
        if (!response.ok) {
            throw new Error('Failed to fetch dropdown options');
        }
        const serverOptions = await response.json();
        
        // Merge server options with predefined options
        dropdownOptions = { ...serverOptions, ...PREDEFINED_DROPDOWNS };
        console.log('Dropdown options loaded:', dropdownOptions);
    } catch (error) {
        console.error('Error fetching dropdown options:', error);
        // Use predefined options if server fetch fails
        dropdownOptions = { ...PREDEFINED_DROPDOWNS };
    }
}

// Populate application status filter options
function populateStatusFilterOptions() {
    const statusFilter = document.getElementById('statusFilter');
    if (!statusFilter) {
        return;
    }

    const previousValue = statusFilter.value;
    const statusOptions = dropdownOptions['Application Status'] || PREDEFINED_DROPDOWNS['Application Status'] || [];

    statusFilter.innerHTML = '<option value=\"\">All Application Statuses</option>';

    statusOptions.forEach(option => {
        const optionElement = document.createElement('option');
        optionElement.value = option;
        optionElement.textContent = option;
        statusFilter.appendChild(optionElement);
    });

    if (previousValue && statusOptions.includes(previousValue)) {
        statusFilter.value = previousValue;
    }
}

// Fetch data from the API
function fetchData() {
    fetch('/api/data')
        .then(response => response.json())
        .then(responseData => {
            const { data, is_admin } = responseData;
            console.log('API Data:', data);
            console.log('Is Admin:', is_admin);
            // Store original data when fetched from API
            originalTableData = JSON.parse(JSON.stringify(data)); // Deep copy
            currentIsAdmin = is_admin;
        updateAdminControls(is_admin);
            // Apply current filter if any
            const positionFilterElement = document.getElementById('positionFilter');
            const statusFilterElement = document.getElementById('statusFilter');
            const hasPositionFilter = positionFilterElement && positionFilterElement.value;
            const hasStatusFilter = statusFilterElement && statusFilterElement.value;
            if (hasPositionFilter || hasStatusFilter) {
                applyTableFilters();
            } else {
                populateTable(data, is_admin);
            }
        })
        .catch(error => {
            console.error('Error fetching data:', error);
            showNotification('Failed to load data. Please try again later.', 'error');
        });
}

// Helper function to get the correct record index for API calls
function getRecordIndex(row) {
    // If row has _originalIndex (from filtering), use it
    if (row._originalIndex !== undefined) {
        return row._originalIndex;
    }
    // Otherwise, find the record in originalTableData
    const index = originalTableData.findIndex(originalRow => {
        // Use Email ID as unique identifier if available
        if (row['Email ID'] && originalRow['Email ID']) {
            return originalRow['Email ID'] === row['Email ID'];
        }
        // Fallback: compare all fields (excluding _originalIndex)
        const rowCopy = { ...row };
        delete rowCopy._originalIndex;
        return JSON.stringify(originalRow) === JSON.stringify(rowCopy);
    });
    // If found, return index; otherwise return -1
    return index !== -1 ? index : tableData.findIndex(r => r === row);
}

// Function to filter table by Interested Position
function filterTableByPosition() {
    applyTableFilters();
}

function applyTableFilters() {
    const positionFilter = document.getElementById('positionFilter');
    const statusFilter = document.getElementById('statusFilter');

    const selectedPosition = positionFilter ? positionFilter.value : '';
    const selectedStatus = statusFilter ? statusFilter.value : '';

    const hasPositionFilter = selectedPosition !== undefined && selectedPosition !== null && selectedPosition !== '';
    const hasStatusFilter = selectedStatus !== undefined && selectedStatus !== null && selectedStatus !== '';

    if (!hasPositionFilter && !hasStatusFilter) {
        populateTable(originalTableData, currentIsAdmin);
        return;
    }

    const filteredData = originalTableData
        .map((row, originalIndex) => ({
            ...row,
            _originalIndex: originalIndex
        }))
        .filter(row => {
            const interestedPosition = row['Interested Position'] || '';
            const applicationStatus = row['Application Status'] || '';
            const matchesPosition = !hasPositionFilter || interestedPosition === selectedPosition;
            const matchesStatus = !hasStatusFilter || applicationStatus === selectedStatus;
            return matchesPosition && matchesStatus;
        });

    populateTable(filteredData, currentIsAdmin);
}

// Function to update sticky column positions based on actual column widths
function updateStickyColumnPositions() {
    const table = document.getElementById('dataTable');
    if (!table) {
        console.log('Table not found');
        return;
    }
    
    const headerRow = table.querySelector('thead tr');
    if (!headerRow) {
        console.log('Header row not found');
        return;
    }
    
    const stickyColumns = ['Date', 'Name', 'Email ID'];
    let cumulativeLeft = 0;
    
    stickyColumns.forEach((columnName, index) => {
        // Find the column index
        const headers = Array.from(headerRow.querySelectorAll('th'));
        const columnIndex = headers.findIndex(th => th.textContent.trim() === columnName);
        
        if (columnIndex !== -1) {
            const headerCell = headers[columnIndex];
            // Use getBoundingClientRect for more accurate width
            const actualWidth = headerCell.getBoundingClientRect().width || headerCell.offsetWidth;
            
            if (actualWidth > 0) {
                // Update header
                headerCell.style.left = `${cumulativeLeft}px`;
                
                // Update all body cells in this column
                const bodyRows = table.querySelectorAll('tbody tr');
                bodyRows.forEach(row => {
                    const cell = row.querySelector(`td:nth-child(${columnIndex + 1})`);
                    if (cell && cell.classList.contains('sticky-column')) {
                        cell.style.left = `${cumulativeLeft}px`;
                    }
                });
                
                cumulativeLeft += actualWidth;
            }
        }
    });
}

// Function to populate the data table
function populateTable(data, isAdmin) {
    tableData = data;
    currentIsAdmin = isAdmin; // Store admin status
    
    const tableBody = document.getElementById('dataTableBody');
    const tableHead = document.getElementById('dataTableHead');
    
    if (!tableBody || !tableHead) {
        console.error('Table elements not found in the DOM');
        return;
    }
    
    tableBody.innerHTML = '';
    tableHead.innerHTML = '';
    
    let columnsToShow = isAdmin ? FIELD_ORDER : ['Date', 'Name', 'Email ID', 'Interested Position', 'Current Role', 'Current Organization', 'Current Location', 'Resume', 'Referred By', 'Interview Status', 'Application Status', 'Initial Screening', 'Round 1 Remarks', 'Round 2 Remarks'];

    if (data && data.length > 0) {
        const availableColumns = Object.keys(data[0]).filter(column => column !== '_originalIndex');
        const ordered = columnsToShow.filter(c => availableColumns.includes(c));
        const remaining = availableColumns.filter(c => !ordered.includes(c));

        tableColumns = isAdmin ? [...ordered, ...remaining] : columnsToShow;
        
        // Create table header
        const headerRow = document.createElement('tr');
        tableColumns.forEach((column, colIndex) => {
            const th = document.createElement('th');
            th.textContent = column;
            // Add sticky-column class to first three columns (Date, Name, Email ID)
            if (column === 'Date' || column === 'Name' || column === 'Email ID') {
                th.classList.add('sticky-column');
            }
            if (column === 'Interview Status') {
                th.style.minWidth = '200px';
            }
            if (column === 'Reject Mail Sent') {
                th.style.minWidth = '150px';
            }
            headerRow.appendChild(th);
        });
        
        // Add action column header (for both admin and non-admin users)
        const actionTh = document.createElement('th');
        actionTh.textContent = 'Actions';
        actionTh.style.minWidth = '120px';
        headerRow.appendChild(actionTh);
        
        tableHead.appendChild(headerRow);
        
        // Create table rows
        data.forEach((row, index) => {
            const tr = document.createElement('tr');
            tr.dataset.index = index;
            tr.style.cursor = 'pointer'; // Add pointer cursor to indicate clickable
            
            // Apply row color based on Application Status
            const applicationStatus = row['Application Status'] || '';
            if (applicationStatus === 'Accepted') {
                tr.classList.add('row-accepted');
            } else if (applicationStatus === 'Rejected') {
                tr.classList.add('row-rejected');
            } else if (applicationStatus === 'On Hold') {
                tr.classList.add('row-onhold');
            } else if (applicationStatus === 'Proceed Further') {
                tr.classList.add('row-proceed');
            }
            
            // Add click event to show candidate details
            tr.addEventListener('click', (e) => {
                // Don't trigger if clicking on action buttons or dropdowns
                if (!e.target.closest('button') && !e.target.closest('select')) {
                    const recordIndex = getRecordIndex(row);
                    showCandidateDetails(row, recordIndex, isAdmin);
                }
            });
            
            tableColumns.forEach((column, colIndex) => {
                const td = document.createElement('td');
                
                // Add sticky-column class to first three columns (Date, Name, Email ID)
                if (column === 'Date' || column === 'Name' || column === 'Email ID') {
                    td.classList.add('sticky-column');
                }
                
                if (column === 'Candidate') {
                    // Display candidate name or a default identifier
                    const candidateName = row['Name'] || row['Name'] || 'Unknown Candidate';
                    td.textContent = candidateName;
                } else if (column === 'Date') {
                    const raw = row[column] || '';
                    if (raw) {
                        const datePart = raw.split(' ')[0];
                        try {
                            const formatted = new Date(datePart).toLocaleDateString();
                            td.textContent = formatted;
                        } catch (e) {
                            td.textContent = datePart;
                        }
                    } else {
                        td.textContent = '';
                    }
                } else if (column === 'Resume' || column === 'LinkedIn Profile') {
                    if (row[column] && row[column].toString().startsWith('http')) {
                        const link = document.createElement('a');
                        link.href = row[column];
                        link.textContent = column === 'Resume' ? 'View Resume' : 'View Profile';
                        link.target = '_blank';
                        link.className = 'text-decoration-none';
                        td.appendChild(link);
                    } else {
                        td.textContent = row[column] || '';
                    }
                } else if (column === 'Interview Status' || column === 'Application Status' || column === 'Reject Mail Sent') {
                    td.dataset.column = column;
                    const currentStatus = row[column] || '';

                    const select = document.createElement('select');
                    select.className = 'form-select';

                    const statusOptions = dropdownOptions[column] || [];
                    
                    // Add empty/null option for Reject Mail Sent (always first)
                    if (column === 'Reject Mail Sent') {
                        const emptyOption = document.createElement('option');
                        emptyOption.value = '';
                        emptyOption.textContent = '';
                        // Select empty option if current status is empty or null
                        if (!currentStatus || currentStatus === '' || currentStatus === null) {
                            emptyOption.selected = true;
                        }
                        select.appendChild(emptyOption);
                    }
                    
                    if (statusOptions.length > 0) {
                        statusOptions.forEach(option => {
                            const optionElement = document.createElement('option');
                            optionElement.value = option;
                            optionElement.textContent = option;
                            // Only select if it matches current status and current status is not empty
                            if (option === currentStatus && currentStatus && currentStatus !== '') {
                                optionElement.selected = true;
                            }
                            select.appendChild(optionElement);
                        });
                        // If current status exists but not in options, add it
                        if (currentStatus && currentStatus !== '' && !statusOptions.includes(currentStatus)) {
                            const optionElement = document.createElement('option');
                            optionElement.value = currentStatus;
                            optionElement.textContent = currentStatus;
                            optionElement.selected = true;
                            select.appendChild(optionElement);
                        }
                    } else {
                        // Fallback if no options available
                        const optionElement = document.createElement('option');
                        optionElement.value = currentStatus || '';
                        optionElement.textContent = currentStatus || 'Select status';
                        if (currentStatus) {
                            optionElement.selected = true;
                        }
                        select.appendChild(optionElement);
                    }

                    // Allow both admin and non-admin users to edit Interview Status, Application Status, and Reject Mail Sent
                    select.addEventListener('change', (e) => {
                        const newStatus = e.target.value;
                        const rowElement = select.closest('tr');
                        const oldStatus = row[column] || '';
                        
                        // Find the correct index to use for update
                        const recordIndex = getRecordIndex(row);
                        
                        // Update row color immediately based on Application Status
                        if (column === 'Application Status') {
                            // Remove existing status classes
                            rowElement.classList.remove('row-accepted', 'row-rejected', 'row-onhold', 'row-proceed');
                            // Add new status class
                            if (newStatus === 'Accepted') {
                                rowElement.classList.add('row-accepted');
                            } else if (newStatus === 'Rejected') {
                                rowElement.classList.add('row-rejected');
                            } else if (newStatus === 'On Hold') {
                                rowElement.classList.add('row-onhold');
                            } else if (newStatus === 'Proceed Further') {
                                rowElement.classList.add('row-proceed');
                            }
                        }
                        
                        // Update status with error handling to revert color if update fails
                        updateRecordStatus(recordIndex, column, newStatus, rowElement, oldStatus, column);
                    });

                    td.appendChild(select);
                } else if (column === 'Timestamp') {
                    // Format date to show only date
                    const dateValue = row[column];
                    if (dateValue) {
                        const formattedDate = new Date(dateValue).toLocaleDateString();
                        td.textContent = formattedDate;
                    } else {
                        td.textContent = '';
                    }
                } else if (column === 'Initial Screening') {
                    // Display Initial Screening column as separate column
                    td.textContent = row['Initial Screening'] || row['Initial Remarks'] || '';
                    td.style.maxWidth = '200px';
                    td.style.overflow = 'hidden';
                    td.style.textOverflow = 'ellipsis';
                    td.style.whiteSpace = 'nowrap';
                    td.title = row['Initial Screening'] || row['Initial Remarks'] || ''; // Show full text on hover
                } else if (column === 'Round 1 Remarks') {
                    // Display Round 1 Remarks column as separate column
                    td.textContent = row['Round 1 Remarks'] || '';
                    td.style.maxWidth = '200px';
                    td.style.overflow = 'hidden';
                    td.style.textOverflow = 'ellipsis';
                    td.style.whiteSpace = 'nowrap';
                    td.title = row['Round 1 Remarks'] || ''; // Show full text on hover
                } else if (column === 'Round 2 Remarks') {
                    // Display Round 2 Remarks column as separate column
                    td.textContent = row['Round 2 Remarks'] || '';
                    td.style.maxWidth = '200px';
                    td.style.overflow = 'hidden';
                    td.style.textOverflow = 'ellipsis';
                    td.style.whiteSpace = 'nowrap';
                    td.title = row['Round 2 Remarks'] || ''; // Show full text on hover
                } else if (column === 'Remarks') {
                    // General remarks column - show only general remarks (not the three screening remarks)
                    td.textContent = row['Remarks'] || '';
                    td.style.maxWidth = '200px';
                    td.style.overflow = 'hidden';
                    td.style.textOverflow = 'ellipsis';
                    td.style.whiteSpace = 'nowrap';
                    td.title = row['Remarks'] || ''; // Show full text on hover
                } else if (column === 'Final Remarks') {
                    // Final Remarks column - expanded width
                    td.textContent = row['Final Remarks'] || '';
                    td.style.minWidth = '300px';
                    td.style.maxWidth = '400px';
                    td.style.overflow = 'hidden';
                    td.style.textOverflow = 'ellipsis';
                    td.style.whiteSpace = 'nowrap';
                    td.title = row['Final Remarks'] || ''; // Show full text on hover
                } else {
                    td.textContent = row[column] || '';
                }
                tr.appendChild(td);
            });

            // Add action buttons (Edit, Delete)
            if (isAdmin) {
                const actionTd = document.createElement('td');
                
                // Find the correct index to use (handle filtering)
                const recordIndex = getRecordIndex(row);
                
                const editBtn = document.createElement('button');
                editBtn.className = 'btn btn-sm btn-primary edit-btn';
                editBtn.title = 'Edit';
                editBtn.innerHTML = '<i class="bi bi-pencil"></i>';
                editBtn.onclick = (e) => {
                    e.stopPropagation(); // Prevent row click
                    openEditModal(recordIndex, isAdmin);
                };
                
                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'btn btn-sm btn-danger delete-btn';
                deleteBtn.title = 'Delete';
                deleteBtn.innerHTML = '<i class="bi bi-trash"></i>';
                deleteBtn.onclick = (e) => {
                    e.stopPropagation(); // Prevent row click
                    deleteRecord(recordIndex);
                };
                
                actionTd.appendChild(editBtn);
                actionTd.appendChild(deleteBtn);
                tr.appendChild(actionTd);
            } else {
                // For non-admin users, add Edit button that only shows Initial Screening and Round 1 Remarks
                const actionTd = document.createElement('td');
                
                // Find the correct index to use (handle filtering)
                const recordIndex = getRecordIndex(row);
                
                const editBtn = document.createElement('button');
                editBtn.className = 'btn btn-sm btn-primary edit-btn';
                editBtn.title = 'Edit';
                editBtn.innerHTML = '<i class="bi bi-pencil"></i>';
                editBtn.onclick = (e) => {
                    e.stopPropagation(); // Prevent row click
                    openEditModal(recordIndex, isAdmin);
                };
                
                actionTd.appendChild(editBtn);
                tr.appendChild(actionTd);
            }
            
            tableBody.appendChild(tr);
        });
        
        // Update sticky column positions based on actual widths (after DOM update)
        setTimeout(() => {
            updateStickyColumnPositions();
        }, 0);
        
        updateGroupByOptions();
    } else {
        console.log('No data available to populate table');
        tableHead.innerHTML = '<tr><th colspan="100%">No data available</th></tr>';
        tableBody.innerHTML = '<tr><td colspan="100%" class="text-center text-muted">No candidates found</td></tr>';
    }
}

// Function to update record status from the table
function updateRecordStatus(index, column, newStatus, rowElement = null, oldStatus = null, statusColumn = null) {
    const record = tableData[index];
    const updatedRecord = { ...record, [column]: newStatus };

    fetch(`/api/data/${index}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedRecord),
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.json();
    })
    .then(data => {
        if (data.status === 'success') {
            showNotification('Status updated successfully!', 'success');
            tableData[index][column] = newStatus; // Update local data to avoid full refresh
        } else {
            showNotification(data.message || 'Failed to update status.', 'error');
            // Revert row color if update failed and we have the row element
            if (rowElement && statusColumn === 'Application Status' && oldStatus !== null) {
                rowElement.classList.remove('row-accepted', 'row-rejected', 'row-onhold', 'row-proceed');
                if (oldStatus === 'Accepted') {
                    rowElement.classList.add('row-accepted');
                } else if (oldStatus === 'Rejected') {
                    rowElement.classList.add('row-rejected');
                } else if (oldStatus === 'On Hold') {
                    rowElement.classList.add('row-onhold');
                } else if (oldStatus === 'Proceed Further') {
                    rowElement.classList.add('row-proceed');
                }
            }
            fetchData(); // Revert change on failure
        }
    })
    .catch(error => {
        console.error('Error updating record:', error);
        showNotification('Error updating record', 'error');
        // Revert row color if update failed and we have the row element
        if (rowElement && statusColumn === 'Application Status' && oldStatus !== null) {
            rowElement.classList.remove('row-accepted', 'row-rejected', 'row-onhold', 'row-proceed');
            if (oldStatus === 'Accepted') {
                rowElement.classList.add('row-accepted');
            } else if (oldStatus === 'Rejected') {
                rowElement.classList.add('row-rejected');
            } else if (oldStatus === 'On Hold') {
                rowElement.classList.add('row-onhold');
            } else if (oldStatus === 'Proceed Further') {
                rowElement.classList.add('row-proceed');
            }
        }
        fetchData(); // Revert change on failure
    });
}

// Update group by options for analysis
function updateGroupByOptions() {
    const groupBySelect = document.getElementById('groupByColumn');
    if (!groupBySelect) {
        return; // Dropdown removed; skip populating options
    }
    groupBySelect.innerHTML = '';
    
    tableColumns.forEach(column => {
        if (column !== 'Date' && 
            column !== 'Email ID' && 
            column !== 'Contact Number' && 
            column !== 'Current CTC per Annum' && 
            column !== 'Expected CTC per Annum' && 
            column !== 'Offered CTC' && 
            column !== 'Resume' && 
            column !== 'LinkedIn Profile' && 
            column !== 'Comments' && 
            column !== 'Remarks' && 
            column !== 'Final Remarks' &&
            column !== 'Initial Screening' && 
            column !== 'Round 1 Remarks' && 
            column !== 'Round 2 Remarks') {
            
            const option = document.createElement('option');
            option.value = column;
            option.textContent = column;
            groupBySelect.appendChild(option);
        }
    });
    
    if (groupBySelect.options.length > 0) {
        fetchGroupAnalysis(groupBySelect.options[0].value);
    }
}

// Function to populate form fields for add/edit modals
function populateFormFields(formId, data = null) {
    const form = document.getElementById(formId);
    
    // For edit form, preserve the hidden input field
    if (formId === 'editDataForm') {
        const hiddenInput = form.querySelector('#editRecordIndex');
        form.innerHTML = '';
        if (hiddenInput) {
            form.appendChild(hiddenInput);
        } else {
            // Create hidden input if it doesn't exist
            const newHiddenInput = document.createElement('input');
            newHiddenInput.type = 'hidden';
            newHiddenInput.id = 'editRecordIndex';
            form.appendChild(newHiddenInput);
        }
    } else {
        // For add form, just clear everything
        form.innerHTML = '';
    }
    // Create form fields based on FIELD_ORDER (standard layout, no grouped cards)
    FIELD_ORDER.forEach(field => {
        if (field !== 'Date' && field !== 'Candidate') {
            const formGroup = document.createElement('div');
            formGroup.className = 'mb-3';

            const label = document.createElement('label');
            label.className = 'form-label';
            label.textContent = field;
            label.htmlFor = field.replace(/\s+/g, '');

            let input;

            if (dropdownOptions[field] && dropdownOptions[field].length > 0) {
                input = document.createElement('select');
                input.className = 'form-select';
                input.id = field.replace(/\s+/g, '');
                input.name = field.replace(/\s+/g, '');

                const defaultOption = document.createElement('option');
                defaultOption.value = '';
                // Empty option for Reject Mail Sent, otherwise show "Select..."
                if (field === 'Reject Mail Sent') {
                    defaultOption.textContent = '';
                } else {
                    defaultOption.textContent = `Select ${field}...`;
                }
                input.appendChild(defaultOption);

                dropdownOptions[field].forEach(option => {
                    const optionElement = document.createElement('option');
                    optionElement.value = option;
                    optionElement.textContent = option;
                    input.appendChild(optionElement);
                });

                if (data && data[field]) {
                    input.value = data[field];
                }
            }
            else if (field === 'Comments' || field === 'Remarks' || field === 'Final Remarks' || field === 'Initial Screening' || field === 'Round 1 Remarks' || field === 'Round 2 Remarks') {
                input = document.createElement('textarea');
                input.className = 'form-control';
                input.id = field.replace(/\s+/g, '');
                input.name = field.replace(/\s+/g, '');
                input.rows = 3;

                if (data && data[field]) {
                    input.value = data[field];
                }
            }
            else if (field === 'Resume' || field === 'LinkedIn Profile') {
                input = document.createElement('input');
                input.type = 'url';
                input.className = 'form-control';
                input.id = field.replace(/\s+/g, '');
                input.name = field.replace(/\s+/g, '');
                input.placeholder = `Enter ${field} URL...`;

                if (data && data[field]) {
                    input.value = data[field];
                }
            }
            else if (field === 'Email ID') {
                input = document.createElement('input');
                input.type = 'email';
                input.className = 'form-control';
                input.id = field.replace(/\s+/g, '');
                input.name = field.replace(/\s+/g, '');
                input.placeholder = `Enter ${field}...`;
                input.required = true;

                if (data && data[field]) {
                    input.value = data[field];
                }
            }
            else if (field === 'Current CTC per Annum' || field === 'Expected CTC per Annum' || field === 'Offered CTC' || field === 'Contact Number') {
                input = document.createElement('input');
                input.type = 'number';
                input.className = 'form-control';
                input.id = field.replace(/\s+/g, '');
                input.name = field.replace(/\s+/g, '');
                input.placeholder = `Enter ${field}...`;

                if (data && data[field]) {
                    input.value = data[field];
                }
            }
            else {
                input = document.createElement('input');
                input.type = 'text';
                input.className = 'form-control';
                input.id = field.replace(/\s+/g, '');
                input.name = field.replace(/\s+/g, '');
                input.placeholder = `Enter ${field}...`;

                if (data && data[field]) {
                    input.value = data[field];
                }
            }

            formGroup.appendChild(label);
            formGroup.appendChild(input);
            form.appendChild(formGroup);
        }
    });
}

// Function to open add modal
function openAddModal() {
    populateFormFields('addDataForm');
    
    const modal = new bootstrap.Modal(document.getElementById('addDataModal'));
    modal.show();
}

// Function to open edit modal
function openEditModal(index, isAdmin) {
    // Use originalTableData since index is always from original data
    const record = originalTableData[index];
    if (!record) {
        console.error('Record not found at index:', index);
        showNotification('Record not found', 'error');
        return;
    }
    
    // Set the edit record index in the form
    const editRecordIndexInput = document.getElementById('editRecordIndex');
    if (editRecordIndexInput) {
        editRecordIndexInput.value = index;
    }
    
    const modal = new bootstrap.Modal(document.getElementById('editDataModal'));
    const formBody = document.getElementById('editFormBody');
    
    formBody.innerHTML = '';
    
    // Determine which fields to show based on admin status
    // For non-admin: show all visible columns but only allow editing Initial Screening and Round 1 Remarks
    let fieldsToShow = isAdmin ? FIELD_ORDER : ['Date', 'Name', 'Email ID', 'Interested Position', 'Current Role', 'Current Organization', 'Current Location', 'Resume', 'Referred By', 'Interview Status', 'Application Status', 'Initial Screening', 'Round 1 Remarks', 'Round 2 Remarks'];
    
    // Fields that are editable for non-admin users
    const editableFieldsForUser = ['Initial Screening', 'Round 1 Remarks'];
    
    // Create form fields for each column
    fieldsToShow.forEach(column => {
        if (column === 'Timestamp') return; // Skip timestamp
        
        const formGroup = document.createElement('div');
        formGroup.className = 'mb-3';
        
        const label = document.createElement('label');
        label.className = 'form-label';
        label.textContent = column;
        
        let input;
        const isEditable = isAdmin || editableFieldsForUser.includes(column);
        
        if (column === 'Interview Status' || column === 'Application Status' || column === 'Reject Mail Sent') {
            input = document.createElement('select');
            input.className = 'form-select';
            if (!isEditable) {
                input.disabled = true;
                input.style.backgroundColor = '#e9ecef';
                input.style.cursor = 'not-allowed';
            }
            
            // Add default/empty option
            const defaultOption = document.createElement('option');
            defaultOption.value = '';
            if (column === 'Reject Mail Sent') {
                defaultOption.textContent = ''; // Empty option for Reject Mail Sent
            } else {
                defaultOption.textContent = 'Select ' + column;
            }
            if (!record[column] || record[column] === '') {
                defaultOption.selected = true;
            }
            input.appendChild(defaultOption);
            
            // Add dropdown options if available
            if (dropdownOptions[column]) {
                dropdownOptions[column].forEach(option => {
                    const optionElement = document.createElement('option');
                    optionElement.value = option;
                    optionElement.textContent = option;
                    if (record[column] === option) {
                        optionElement.selected = true;
                    }
                    input.appendChild(optionElement);
                });
            }
        } else if (column === 'Resume' || column === 'LinkedIn Profile') {
            input = document.createElement('input');
            input.type = 'url';
            input.className = 'form-control';
            input.value = record[column] || '';
            if (!isEditable) {
                input.readOnly = true;
                input.style.backgroundColor = '#e9ecef';
                input.style.cursor = 'not-allowed';
            }
        } else {
            input = document.createElement('textarea');
            input.className = 'form-control';
            input.rows = column.includes('Remarks') || column.includes('Screening') ? 3 : 1;
            input.value = record[column] || '';
            if (!isEditable) {
                input.readOnly = true;
                input.style.backgroundColor = '#e9ecef';
                input.style.cursor = 'not-allowed';
            }
        }
        
        input.id = 'edit_' + column;
        input.name = column;
        
        formGroup.appendChild(label);
        formGroup.appendChild(input);
        formBody.appendChild(formGroup);
    });
    
    modal.show();
}

// Function to save new record
function saveNewRecord() {
    const formData = new FormData(document.getElementById('addDataForm'));
    const newRecord = {};
    
    // Convert form data to object
    for (let [key, value] of formData.entries()) {
        // Convert keys back to original format with spaces
        const originalKey = FIELD_ORDER.find(field => field.replace(/\s+/g, '') === key) || key;
        newRecord[originalKey] = value;
    }
    
    fetch('/api/data', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(newRecord),
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            showNotification('Record added successfully!', 'success');
            fetchData(); // Refresh table
            bootstrap.Modal.getInstance(document.getElementById('addDataModal')).hide();
        } else {
            showNotification(data.message || 'Failed to add record.', 'error');
        }
    })
    .catch(error => {
        console.error('Error adding record:', error);
        showNotification('Error adding record', 'error');
    });
}

// Function to update record
function updateRecord() {
    const index = document.getElementById('editRecordIndex').value;
    const formData = new FormData(document.getElementById('editDataForm'));
    const updatedRecord = {};
    
    // Convert form data to object
    for (let [key, value] of formData.entries()) {
        // Convert keys back to original format with spaces
        const originalKey = FIELD_ORDER.find(field => field.replace(/\s+/g, '') === key) || key;
        updatedRecord[originalKey] = value;
    }
    
    fetch(`/api/data/${index}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedRecord),
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            showNotification('Record updated successfully!', 'success');
            fetchData(); // Refresh table
            bootstrap.Modal.getInstance(document.getElementById('editDataModal')).hide();
        } else {
            showNotification(data.message || 'Failed to update record.', 'error');
        }
    })
    .catch(error => {
        console.error('Error updating record:', error);
        showNotification('Error updating record', 'error');
    });
}

// Function to delete record
function deleteRecord(index) {
    if (confirm('Are you sure you want to delete this record?')) {
        fetch(`/api/data/${index}`, {
            method: 'DELETE',
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                showNotification('Record deleted successfully!', 'success');
                fetchData(); // Refresh table
            } else {
                showNotification(data.message || 'Failed to delete record.', 'error');
            }
        })
        .catch(error => {
            console.error('Error deleting record:', error);
            showNotification('Error deleting record', 'error');
        });
    }
}

// Function to show notifications
function showNotification(message, type) {
    const notificationContainer = document.getElementById('notificationContainer');
    if (!notificationContainer) return;
    
    const notification = document.createElement('div');
    notification.className = `alert alert-${type === 'success' ? 'success' : 'danger'} alert-dismissible fade show`;
    notification.role = 'alert';
    notification.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    notificationContainer.appendChild(notification);
    
    // Auto-dismiss after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 5000);
}

// Function to fetch summary data
function fetchSummary() {
    fetch('/api/analysis/summary')
        .then(response => response.json())
        .then(data => {
            displaySummary(data);
        })
        .catch(error => {
            console.error('Error fetching summary:', error);
        });
}

// Function to fetch analytics data
function fetchAnalyticsData() {
    fetch('/api/analytics')
        .then(response => response.json())
        .then(data => {
            displayAnalyticsData(data);
        })
        .catch(error => {
            console.error('Error fetching analytics data:', error);
        });
}

// Function to display analytics data
function displayAnalyticsData(data) {
    const overallAnalyticsBody = document.getElementById('overallAnalyticsBody');
    const hiringFunnelBody = document.getElementById('hiringFunnelBody');

    if (!overallAnalyticsBody || !hiringFunnelBody) {
        console.error('Analytics tables not found.');
        return;
    }

    // Clear existing content
    overallAnalyticsBody.innerHTML = '';
    hiringFunnelBody.innerHTML = '';

    // Populate Overall Analytics Table
    overallAnalyticsBody.innerHTML = `
        <tr>
            <td>Total Applicant</td>
            <td>${data.total_applicant}</td>
        </tr>
        <tr>
            <td>Total Rejected</td>
            <td>${data.total_rejected}</td>
        </tr>
        <tr>
            <td>No response</td>
            <td>${data.no_response}</td>
        </tr>
        <tr>
            <td>Not Interviewed</td>
            <td>${data.not_interviewed}</td>
        </tr>
    `;

    // Populate Hiring Funnel Table
    hiringFunnelBody.innerHTML = `
        <tr>
            <td>Total Round 2 Completed</td>
            <td>${data.total_round_2_completed}</td>
        </tr>
        <tr>
            <td>Didn't Join</td>
            <td>${data.did_not_join}</td>
        </tr>
        <tr>
            <td>On Hold</td>
            <td>${data.on_hold}</td>
        </tr>
        <tr>
            <td>Accepted waiting Reference</td>
            <td>${data.accepted_waiting_reference}</td>
        </tr>
        <tr>
            <td>Total In Notice/Yet to join</td>
            <td>${data.total_in_notice_yet_to_join}</td>
        </tr>
        <tr>
            <td>Total Joined</td>
            <td>${data.total_joined}</td>
        </tr>
        <tr>
            <td>Intern</td>
            <td>${data.intern}</td>
        </tr>
    `;
}

// Display summary data
function displaySummary(data) {
    const summaryContainer = document.getElementById('summaryContainer');
    // Guard: if the container is missing, avoid runtime errors
    if (!summaryContainer) {
        console.warn('Summary container not found in DOM. Skipping summary render.');
        return;
    }
    summaryContainer.innerHTML = '';
    
    for (const [column, stats] of Object.entries(data)) {
        const card = document.createElement('div');
        card.className = 'card mb-3 shadow-sm';
        
        const cardHeader = document.createElement('div');
        cardHeader.className = 'card-header bg-primary text-white';
        cardHeader.textContent = column;
        
        const cardBody = document.createElement('div');
        cardBody.className = 'card-body';
        
        const statsList = document.createElement('ul');
        statsList.className = 'list-group list-group-flush';
        
        for (const [stat, value] of Object.entries(stats)) {
            const listItem = document.createElement('li');
            listItem.className = 'list-group-item d-flex justify-content-between align-items-center';
            
            const statName = document.createElement('span');
            statName.textContent = stat.charAt(0).toUpperCase() + stat.slice(1);
            
            const statValue = document.createElement('span');
            statValue.className = 'badge bg-primary rounded-pill';
            statValue.textContent = typeof value === 'number' ? value.toFixed(2) : value;
            
            listItem.appendChild(statName);
            listItem.appendChild(statValue);
            statsList.appendChild(listItem);
        }
        
        cardBody.appendChild(statsList);
        card.appendChild(cardHeader);
        card.appendChild(cardBody);
        summaryContainer.appendChild(card);
    }
}

// Fetch group analysis data
function fetchGroupAnalysis(column) {
    fetch(`/api/analysis/group/${column}`)
        .then(response => response.json())
        .then(data => {
            updateGroupChart(data, column);
        })
        .catch(error => {
            console.error('Error fetching group analysis:', error);
        });
}

// Update group chart
function updateGroupChart(data, groupColumn) {
    const groupCanvas = document.getElementById('groupChart');
    if (!groupCanvas) {
        return;
    }
    const ctx = groupCanvas.getContext('2d');
    
    const labels = data.map(item => item[groupColumn] || 'Unknown');
    const counts = data.map(item => item.count || 0);
    
    if (groupChart) {
        groupChart.destroy();
    }
    
    groupChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Count',
                data: counts,
                backgroundColor: 'rgba(75, 192, 192, 0.6)',
                borderColor: 'rgba(75, 192, 192, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: `Candidates by ${groupColumn}`
                },
                legend: {
                    position: 'top'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Count'
                    }
                }
            }
        }
    });
}

// Analytics Functions
function updateMonthlyStats(data) {
    const monthlyStats = {};
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    // Initialize monthly stats
    data.forEach(candidate => {
        let dateStr = candidate['Date'] || candidate['Timestamp'] || '';
        if (!dateStr) return;
        
        // Parse date - handle different formats
        let date;
        if (dateStr.includes(' ')) {
            dateStr = dateStr.split(' ')[0]; // Take only date part
        }
        date = new Date(dateStr);
        
        if (isNaN(date.getTime())) return;
        
        const monthKey = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
        
        if (!monthlyStats[monthKey]) {
            monthlyStats[monthKey] = {
                applicants: 0,
                accepted: 0,
                rejected: 0,
                inNotice: 0,
                joined: 0,
                feedbackGiven: 0
            };
        }
        
        monthlyStats[monthKey].applicants++;
        
        switch (candidate['Application Status']) {
            case 'Accepted':
                monthlyStats[monthKey].accepted++;
                break;
            case 'Rejected':
                monthlyStats[monthKey].rejected++;
                break;
            case 'In Notice':
                monthlyStats[monthKey].inNotice++;
                break;
            case 'Joined':
                monthlyStats[monthKey].joined++;
                break;
        }
        
        if (candidate['Reference Feedback']) {
            monthlyStats[monthKey].feedbackGiven++;
        }
    });
    
    // Sort months chronologically
    const sortedMonths = Object.keys(monthlyStats).sort((a, b) => {
        const [monthA, yearA] = a.split(' ');
        const [monthB, yearB] = b.split(' ');
        return new Date(`${monthA} 1, ${yearA}`) - new Date(`${monthB} 1, ${yearB}`);
    });
    
    // Update table
    const tbody = document.getElementById('monthlyStatsBody');
    const tfoot = document.getElementById('monthlyStatsTotals');
    tbody.innerHTML = '';
    
    const totals = {
        applicants: 0,
        accepted: 0,
        rejected: 0,
        inNotice: 0,
        joined: 0,
        feedbackGiven: 0
    };
    
    sortedMonths.forEach(month => {
        const stats = monthlyStats[month];
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${month}</td>
            <td class="text-center">${stats.applicants}</td>
            <td class="text-center">${stats.accepted}</td>
            <td class="text-center">${stats.rejected}</td>
            <td class="text-center">${stats.inNotice}</td>
            <td class="text-center">${stats.joined}</td>
            <td class="text-center">${stats.feedbackGiven}</td>
        `;
        tbody.appendChild(row);
        
        // Update totals
        Object.keys(totals).forEach(key => {
            totals[key] += stats[key];
        });
    });
    
    // Add totals row
    tfoot.innerHTML = `
        <tr class="table-success fw-bold">
            <td>Total</td>
            <td class="text-center">${totals.applicants}</td>
            <td class="text-center">${totals.accepted}</td>
            <td class="text-center">${totals.rejected}</td>
            <td class="text-center">${totals.inNotice}</td>
            <td class="text-center">${totals.joined}</td>
            <td class="text-center">${totals.feedbackGiven}</td>
        </tr>
    `;
    
    // Update key metrics
    updateKeyMetrics(totals, data);
    
    // Update position statistics
    updatePositionStats(data);
}

// Update Position Statistics Table
function updatePositionStats(data) {
    const positionStats = {};
    
    // Count applicants and joined by position
    data.forEach(candidate => {
        const position = candidate['Interested Position'] || 'Not Specified';
        
        if (!positionStats[position]) {
            positionStats[position] = {
                applied: 0,
                joined: 0
            };
        }
        
        positionStats[position].applied++;
        
        if (candidate['Application Status'] === 'Joined') {
            positionStats[position].joined++;
        }
    });
    
    // Sort positions by number of applicants (descending)
    const sortedPositions = Object.keys(positionStats).sort((a, b) => {
        return positionStats[b].applied - positionStats[a].applied;
    });
    
    // Update table
    const tbody = document.getElementById('positionStatsBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (sortedPositions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted">No position data available</td></tr>';
        return;
    }
    
    sortedPositions.forEach(position => {
        const stats = positionStats[position];
        const row = document.createElement('tr');
        row.innerHTML = `
            <td style="font-weight: 500; color: #1f2937;">${position}</td>
            <td style="text-align: center; font-weight: 600; color: #5b5fef;">${stats.applied}</td>
            <td style="text-align: center; font-weight: 600; color: #10b981;">${stats.joined}</td>
        `;
        tbody.appendChild(row);
    });
}

function updateKeyMetrics(totals, data) {
    // Update old metrics container if it exists
    const metricsContainer = document.getElementById('keyMetricsContainer');
    if (metricsContainer) {
        const metrics = [
            { label: 'Total Applicants', value: totals.applicants },
            { label: 'Total Accepted', value: totals.accepted },
            { label: 'Total Rejected', value: totals.rejected },
            { label: 'Currently In Notice', value: totals.inNotice },
            { label: 'Total Joined', value: totals.joined }
        ];
        
        metricsContainer.innerHTML = metrics.map(metric => `
            <div class="mb-3">
                <div class="d-flex justify-content-between align-items-center">
                    <span class="text-muted">${metric.label}</span>
                    <span class="h5 mb-0">${metric.value}</span>
                </div>
                <div class="progress mt-2" style="height: 4px;">
                    <div class="progress-bar" style="width: ${(metric.value / totals.applicants * 100) || 0}%"></div>
                </div>
            </div>
        `).join('');
    }

    // Update new spreadsheet-style metrics panel
    const metricsPanel = document.getElementById('metricsPanel');
    if (metricsPanel) {
        // Calculate counts for each remarks column
        let initialScreeningCount = 0;
        let round1RemarksCount = 0;
        let round2RemarksCount = 0;
        let finalRemarksCount = 0;
        let remarksCount = 0;

        data.forEach(candidate => {
            if (candidate['Initial Screening'] && candidate['Initial Screening'].trim()) {
                initialScreeningCount++;
            }
            if (candidate['Round 1 Remarks'] && candidate['Round 1 Remarks'].trim()) {
                round1RemarksCount++;
            }
            if (candidate['Round 2 Remarks'] && candidate['Round 2 Remarks'].trim()) {
                round2RemarksCount++;
            }
            if (candidate['Final Remarks'] && candidate['Final Remarks'].trim()) {
                finalRemarksCount++;
            }
            if (candidate['Remarks'] && candidate['Remarks'].trim()) {
                remarksCount++;
            }
        });

        metricsPanel.innerHTML = `
            <table class="metrics-table">
                <thead>
                    <tr>
                        <th>Metric</th>
                        <th style="text-align: right;">Value</th>
                    </tr>
                </thead>
                <tbody>
                    <tr class="metric-row-metrics">
                        <td class="metric-label">Total Applicants</td>
                        <td class="metric-value">${totals.applicants}</td>
                    </tr>
                    <tr class="metric-row-metrics">
                        <td class="metric-label">Total Accepted</td>
                        <td class="metric-value">${totals.accepted}</td>
                    </tr>
                    <tr class="metric-row-metrics">
                        <td class="metric-label">Total Rejected</td>
                        <td class="metric-value">${totals.rejected}</td>
                    </tr>
                    <tr class="metric-row-metrics">
                        <td class="metric-label">Total In Notice</td>
                        <td class="metric-value">${totals.inNotice}</td>
                    </tr>
                    <tr class="metric-row-metrics">
                        <td class="metric-label">Total Joined</td>
                        <td class="metric-value">${totals.joined}</td>
                    </tr>
                </tbody>
            </table>
            <div class="metrics-section-header">Remarks</div>
            <table class="metrics-table">
                <tbody>
                    <tr class="metric-row-hr">
                        <td class="metric-label">Initial Screening</td>
                        <td class="metric-value">${initialScreeningCount}</td>
                    </tr>
                    <tr class="metric-row-hr">
                        <td class="metric-label">Round 1 Remarks</td>
                        <td class="metric-value">${round1RemarksCount}</td>
                    </tr>
                    <tr class="metric-row-hr">
                        <td class="metric-label">Round 2 Remarks</td>
                        <td class="metric-value">${round2RemarksCount}</td>
                    </tr>
                    <tr class="metric-row-hr">
                        <td class="metric-label">Final Remarks</td>
                        <td class="metric-value">${finalRemarksCount}</td>
                    </tr>
                    <tr class="metric-row-hr">
                        <td class="metric-label">Remarks</td>
                        <td class="metric-value">${remarksCount}</td>
                    </tr>
                </tbody>
            </table>
        `;
    }
}

function updateApplicationStatusChart(data) {
    const statusCounts = {
        'Total Applicants': data.length,
        'Accepted': 0,
        'Rejected': 0,
        'In Notice': 0,
        'Joined': 0
    };
    
    data.forEach(candidate => {
        if (statusCounts.hasOwnProperty(candidate['Application Status'])) {
            statusCounts[candidate['Application Status']]++;
        }
    });
    
    const ctx = document.getElementById('applicationStatusChart').getContext('2d');
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(statusCounts),
            datasets: [{
                data: Object.values(statusCounts),
                backgroundColor: [
                    '#4f46e5',
                    '#10b981',
                    '#ef4444',
                    '#f59e0b',
                    '#3b82f6'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}

function updateReferenceFeedbackChart(data) {
    const feedbackCounts = {
        'All 3 Given': 0,
        '2 Given': 0,
        '1 Given': 0,
        '0 Given': 0
    };
    
    data.forEach(candidate => {
        const feedback = candidate['Reference Feedback'] || '';
        const count = feedback.split(',').filter(f => f.trim()).length;
        switch (count) {
            case 3:
                feedbackCounts['All 3 Given']++;
                break;
            case 2:
                feedbackCounts['2 Given']++;
                break;
            case 1:
                feedbackCounts['1 Given']++;
                break;
            default:
                feedbackCounts['0 Given']++;
        }
    });
    
    const ctx = document.getElementById('referenceFeedbackChart').getContext('2d');
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(feedbackCounts),
            datasets: [{
                data: Object.values(feedbackCounts),
                backgroundColor: [
                    '#10b981',
                    '#3b82f6',
                    '#f59e0b',
                    '#ef4444'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}

function updateOverallDistributionChart(data) {
    const months = {};
    data.forEach(candidate => {
        const date = new Date(candidate.Timestamp);
        const monthKey = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        if (!months[monthKey]) {
            months[monthKey] = 0;
        }
        months[monthKey]++;
    });
    
    const ctx = document.getElementById('overallDistributionChart').getContext('2d');
    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(months),
            datasets: [{
                data: Object.values(months),
                backgroundColor: [
                    '#4f46e5',
                    '#10b981',
                    '#ef4444',
                    '#f59e0b',
                    '#3b82f6',
                    '#8b5cf6',
                    '#ec4899',
                    '#14b8a6',
                    '#f43f5e',
                    '#84cc16',
                    '#06b6d4',
                    '#6366f1'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right'
                }
            }
        }
    });
}

// Chart instances for new analytics
let interviewStatusChart = null;
let currentLocationChart = null;
let locationPreferenceChart = null;
let ctcComparisonChart = null;
let experienceChart = null;
let referralSourceChart = null;
let noticePeriodChart = null;
let monthlyTrendsChart = null;


// Interview Status Pie Chart
function updateInterviewStatusChart(data) {
    const statusCounts = {};
    
    data.forEach(candidate => {
        const status = candidate['Interview Status'] || 'Not Specified';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
    });
    
    const ctx = document.getElementById('interviewStatusChart');
    if (!ctx) return;
    
    if (interviewStatusChart) {
        interviewStatusChart.destroy();
    }
    
    interviewStatusChart = new Chart(ctx.getContext('2d'), {
        type: 'pie',
        data: {
            labels: Object.keys(statusCounts),
            datasets: [{
                data: Object.values(statusCounts),
                backgroundColor: [
                    '#4f46e5', '#10b981', '#ef4444', '#f59e0b', '#3b82f6',
                    '#8b5cf6', '#ec4899', '#14b8a6', '#f43f5e', '#84cc16'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right'
                }
            }
        }
    });
}

// Current Location Chart
function updateCurrentLocationChart(data) {
    const locationCounts = {};
    
    data.forEach(candidate => {
        const location = candidate['Current Location'] || 'Not Specified';
        locationCounts[location] = (locationCounts[location] || 0) + 1;
    });
    
    const ctx = document.getElementById('currentLocationChart');
    if (!ctx) return;
    
    if (currentLocationChart) {
        currentLocationChart.destroy();
    }
    
    currentLocationChart = new Chart(ctx.getContext('2d'), {
        type: 'doughnut',
        data: {
            labels: Object.keys(locationCounts),
            datasets: [{
                data: Object.values(locationCounts),
                backgroundColor: [
                    '#4f46e5', '#10b981', '#ef4444', '#f59e0b', '#3b82f6',
                    '#8b5cf6', '#ec4899', '#14b8a6', '#f43f5e', '#84cc16'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right'
                }
            }
        }
    });
}

// Location Preference Chart
function updateLocationPreferenceChart(data) {
    const locationCounts = {};
    
    data.forEach(candidate => {
        const location = candidate['Location Preference'] || 'Not Specified';
        locationCounts[location] = (locationCounts[location] || 0) + 1;
    });
    
    const ctx = document.getElementById('locationPreferenceChart');
    if (!ctx) return;
    
    if (locationPreferenceChart) {
        locationPreferenceChart.destroy();
    }
    
    locationPreferenceChart = new Chart(ctx.getContext('2d'), {
        type: 'doughnut',
        data: {
            labels: Object.keys(locationCounts),
            datasets: [{
                data: Object.values(locationCounts),
                backgroundColor: [
                    '#4f46e5', '#10b981', '#ef4444', '#f59e0b', '#3b82f6',
                    '#8b5cf6', '#ec4899', '#14b8a6', '#f43f5e', '#84cc16'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right'
                }
            }
        }
    });
}

// CTC Comparison Chart
function updateCTCComparisonChart(data) {
    const currentCTC = [];
    const expectedCTC = [];
    const offeredCTC = [];
    
    data.forEach(candidate => {
        const current = parseFloat(candidate['Current CTC per Annum']) || 0;
        const expected = parseFloat(candidate['Expected CTC per Annum']) || 0;
        const offered = parseFloat(candidate['Offered CTC']) || 0;
        
        if (current > 0) currentCTC.push(current);
        if (expected > 0) expectedCTC.push(expected);
        if (offered > 0) offeredCTC.push(offered);
    });
    
    const calculateStats = (arr) => {
        if (arr.length === 0) return { avg: 0, min: 0, max: 0 };
        return {
            avg: arr.reduce((a, b) => a + b, 0) / arr.length,
            min: Math.min(...arr),
            max: Math.max(...arr)
        };
    };
    
    const currentStats = calculateStats(currentCTC);
    const expectedStats = calculateStats(expectedCTC);
    const offeredStats = calculateStats(offeredCTC);
    
    const ctx = document.getElementById('ctcComparisonChart');
    if (!ctx) return;
    
    if (ctcComparisonChart) {
        ctcComparisonChart.destroy();
    }
    
    ctcComparisonChart = new Chart(ctx.getContext('2d'), {
        type: 'bar',
        data: {
            labels: ['Average', 'Minimum', 'Maximum'],
            datasets: [
                {
                    label: 'Current CTC',
                    data: [currentStats.avg, currentStats.min, currentStats.max],
                    backgroundColor: 'rgba(79, 70, 229, 0.6)',
                    borderColor: 'rgba(79, 70, 229, 1)',
                    borderWidth: 1
                },
                {
                    label: 'Expected CTC',
                    data: [expectedStats.avg, expectedStats.min, expectedStats.max],
                    backgroundColor: 'rgba(16, 185, 129, 0.6)',
                    borderColor: 'rgba(16, 185, 129, 1)',
                    borderWidth: 1
                },
                {
                    label: 'Offered CTC',
                    data: [offeredStats.avg, offeredStats.min, offeredStats.max],
                    backgroundColor: 'rgba(239, 68, 68, 0.6)',
                    borderColor: 'rgba(239, 68, 68, 1)',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.dataset.label + ': ₹' + context.parsed.y.toLocaleString('en-IN');
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return '₹' + value.toLocaleString('en-IN');
                        }
                    }
                }
            }
        }
    });
}

// Experience Level Chart
function updateExperienceChart(data) {
    const experienceCounts = {};
    
    data.forEach(candidate => {
        const exp = candidate['Total Years of Experience'] || 'Not Specified';
        experienceCounts[exp] = (experienceCounts[exp] || 0) + 1;
    });
    
    const ctx = document.getElementById('experienceChart');
    if (!ctx) return;
    
    if (experienceChart) {
        experienceChart.destroy();
    }
    
    experienceChart = new Chart(ctx.getContext('2d'), {
        type: 'bar',
        data: {
            labels: Object.keys(experienceCounts),
            datasets: [{
                label: 'Candidates',
                data: Object.values(experienceCounts),
                backgroundColor: 'rgba(59, 130, 246, 0.6)',
                borderColor: 'rgba(59, 130, 246, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}

// Referral Source Chart
function updateReferralSourceChart(data) {
    const referralCounts = {};
    
    data.forEach(candidate => {
        const referral = candidate['Referred By'] || 'Not Specified';
        referralCounts[referral] = (referralCounts[referral] || 0) + 1;
    });
    
    const ctx = document.getElementById('referralSourceChart');
    if (!ctx) return;
    
    if (referralSourceChart) {
        referralSourceChart.destroy();
    }
    
    referralSourceChart = new Chart(ctx.getContext('2d'), {
        type: 'pie',
        data: {
            labels: Object.keys(referralCounts),
            datasets: [{
                data: Object.values(referralCounts),
                backgroundColor: [
                    '#4f46e5', '#10b981', '#ef4444', '#f59e0b', '#3b82f6',
                    '#8b5cf6', '#ec4899', '#14b8a6', '#f43f5e', '#84cc16'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right'
                }
            }
        }
    });
}

// Notice Period Chart
function updateNoticePeriodChart(data) {
    const noticeCounts = {};
    
    data.forEach(candidate => {
        const notice = candidate['Notice Period'] || 'Not Specified';
        noticeCounts[notice] = (noticeCounts[notice] || 0) + 1;
    });
    
    const ctx = document.getElementById('noticePeriodChart');
    if (!ctx) return;
    
    if (noticePeriodChart) {
        noticePeriodChart.destroy();
    }
    
    noticePeriodChart = new Chart(ctx.getContext('2d'), {
        type: 'bar',
        data: {
            labels: Object.keys(noticeCounts),
            datasets: [{
                label: 'Candidates',
                data: Object.values(noticeCounts),
                backgroundColor: 'rgba(245, 158, 11, 0.6)',
                borderColor: 'rgba(245, 158, 11, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}

// Monthly Trends Line Chart
function updateMonthlyTrendsChart(data) {
    const monthlyData = {};
    
    data.forEach(candidate => {
        let dateStr = candidate['Date'] || candidate['Timestamp'] || '';
        if (!dateStr) return;
        
        // Parse date - handle different formats
        let date;
        if (dateStr.includes(' ')) {
            dateStr = dateStr.split(' ')[0]; // Take only date part
        }
        date = new Date(dateStr);
        
        if (isNaN(date.getTime())) return;
        
        const monthKey = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        
        if (!monthlyData[monthKey]) {
            monthlyData[monthKey] = {
                total: 0,
                accepted: 0,
                rejected: 0,
                joined: 0
            };
        }
        
        monthlyData[monthKey].total++;
        
        const appStatus = candidate['Application Status'] || '';
        if (appStatus === 'Accepted') monthlyData[monthKey].accepted++;
        if (appStatus === 'Rejected') monthlyData[monthKey].rejected++;
        if (appStatus === 'Joined') monthlyData[monthKey].joined++;
    });
    
    // Sort months chronologically
    const sortedMonths = Object.keys(monthlyData).sort((a, b) => {
        const [monthA, yearA] = a.split(' ');
        const [monthB, yearB] = b.split(' ');
        return new Date(`${monthA} 1, ${yearA}`) - new Date(`${monthB} 1, ${yearB}`);
    });
    
    const ctx = document.getElementById('monthlyTrendsChart');
    if (!ctx) return;
    
    if (monthlyTrendsChart) {
        monthlyTrendsChart.destroy();
    }
    
    monthlyTrendsChart = new Chart(ctx.getContext('2d'), {
        type: 'line',
        data: {
            labels: sortedMonths,
            datasets: [
                {
                    label: 'Total Applications',
                    data: sortedMonths.map(m => monthlyData[m].total),
                    borderColor: 'rgba(79, 70, 229, 1)',
                    backgroundColor: 'rgba(79, 70, 229, 0.1)',
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'Accepted',
                    data: sortedMonths.map(m => monthlyData[m].accepted),
                    borderColor: 'rgba(16, 185, 129, 1)',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'Rejected',
                    data: sortedMonths.map(m => monthlyData[m].rejected),
                    borderColor: 'rgba(239, 68, 68, 1)',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'Joined',
                    data: sortedMonths.map(m => monthlyData[m].joined),
                    borderColor: 'rgba(59, 130, 246, 1)',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    tension: 0.4,
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    refreshData();
});

// Update the existing refreshData function to include analytics updates
async function refreshData() {
    try {
        const response = await fetch('/api/data');
        const data = await response.json();
        console.log('Data refreshed:', data); // Add this line to log the refreshed data
        
        // Store original data when refreshed
        originalTableData = JSON.parse(JSON.stringify(data.data)); // Deep copy
        currentIsAdmin = data.is_admin;
        updateAdminControls(data.is_admin);
        
        // Apply current filter if any
        const positionFilterElement = document.getElementById('positionFilter');
        const statusFilterElement = document.getElementById('statusFilter');
        const hasPositionFilter = positionFilterElement && positionFilterElement.value;
        const hasStatusFilter = statusFilterElement && statusFilterElement.value;
        if (hasPositionFilter || hasStatusFilter) {
            applyTableFilters();
        } else {
            // Update table
            populateTable(data.data, data.is_admin);
        }
        
        // Update analytics if on analytics tab
        if (document.getElementById('analysisTab') && document.getElementById('analysisTab').classList.contains('active')) {
            updateMonthlyStats(data.data);
            updateApplicationStatusChart(data.data);
            // Update remaining analytics charts
            // updatePositionChart(data.data); // Removed
            updateCurrentLocationChart(data.data);
            updateCTCComparisonChart(data.data);
        }
    } catch (error) {
        console.error('Error refreshing data:', error);
        showToast('Error refreshing data', 'danger');
    }
}

// Update the existing showCandidateDetails function to format dates consistently
function showCandidateDetails(candidate, index, isAdmin) {
    const modal = document.getElementById('candidateDetailModal');
    const content = document.getElementById('candidateDetailContent');

    // Format the content with consistent date formatting
    let detailsHTML = '';

    // Show only user-visible columns for non-admin; full order for admin
    let fieldsToDisplay = isAdmin ? FIELD_ORDER : ['Date', 'Name', 'Email ID', 'Interested Position', 'Current Role', 'Current Organization', 'Current Location', 'Resume', 'Referred By', 'Interview Status', 'Application Status', 'Initial Screening', 'Round 1 Remarks', 'Round 2 Remarks'];
    
    // Define editable fields based on user role
    // Non-admin users can edit only Initial Screening and Round 1 Remarks
    const editableFields = isAdmin ? null : ['Initial Screening', 'Round 1 Remarks']; // null means all fields editable for admin

    // Add primary fields first
    fieldsToDisplay.forEach(field => {
        if (candidate[field] !== undefined) {
            let value = candidate[field];
            let displayValue = formatFieldValue(field, value);
            let inputType = 'text'; // Default input type

            if (field === 'Timestamp') {
                displayValue = new Date(value).toLocaleDateString();
                // Date field is not directly editable as a text input in this context,
                // it's derived from the original data.
                // For now, we'll keep it as display only.
                detailsHTML += `
                    <div class="candidate-detail-item">
                        <span class="candidate-detail-label">${field}:</span>
                        <span class="candidate-detail-value">${displayValue}</span>
                    </div>
                `;
            } else {
                // Special handling for Resume and LinkedIn Profile
                if (field === 'Resume' && candidate[field] && candidate[field].toString().startsWith('http')) {
                    const isEditable = editableFields === null || editableFields.includes(field);
                    detailsHTML += `
                        <div class="candidate-detail-item" data-candidate-index="${index}" data-field-name="${field}" data-editable="${isEditable}">
                            <span class="candidate-detail-label">${field}:</span>
                            <span class="candidate-detail-value display-mode" id="display-${field.replace(/\s/g, '')}">
                                <a href="${candidate[field]}" target="_blank" class="btn btn-outline-primary btn-sm">
                                    <i class="bi bi-file-earmark-pdf me-1"></i>View Resume
                                </a>
                            </span>
                            <input type="url" class="form-control edit-mode" id="input-${field.replace(/\s/g, '')}" value="${displayValue}" style="display: none;" ${!isEditable ? 'readonly' : ''}>
                        </div>
                    `;
                } else if (field === 'LinkedIn Profile' && candidate[field] && candidate[field].toString().startsWith('http')) {
                    const isEditable = editableFields === null || editableFields.includes(field);
                    detailsHTML += `
                        <div class="candidate-detail-item" data-candidate-index="${index}" data-field-name="${field}" data-editable="${isEditable}">
                            <span class="candidate-detail-label">${field}:</span>
                            <span class="candidate-detail-value display-mode" id="display-${field.replace(/\s/g, '')}">
                                <a href="${candidate[field]}" target="_blank" class="btn btn-outline-primary btn-sm">
                                    <i class="bi bi-linkedin me-1"></i>View LinkedIn
                                </a>
                            </span>
                            <input type="url" class="form-control edit-mode" id="input-${field.replace(/\s/g, '')}" value="${displayValue}" style="display: none;" ${!isEditable ? 'readonly' : ''}>
                        </div>
                    `;
                } else if (field === 'Interview Status' || field === 'Application Status' || field === 'Reject Mail Sent') {
                    const isEditable = editableFields === null || editableFields.includes(field);
                    // Always show as dropdown; disable for non-admin users
                    const statusOptions = dropdownOptions[field] || [];
                    let optionsHTML = '';
                    
                    // Add empty/null option for Reject Mail Sent
                    if (field === 'Reject Mail Sent') {
                        const emptySelected = !candidate[field] || candidate[field] === '' ? 'selected' : '';
                        optionsHTML += `<option value="" ${emptySelected}></option>`;
                    }
                    
                    statusOptions.forEach(option => {
                        const selected = candidate[field] === option ? 'selected' : '';
                        optionsHTML += `<option value="${option}" ${selected}>${option}</option>`;
                    });
                    
                    detailsHTML += `
                        <div class="candidate-detail-item" data-candidate-index="${index}" data-field-name="${field}" data-editable="${isEditable}">
                            <span class="candidate-detail-label">${field}:</span>
                            <select class="form-select" id="input-${field.replace(/\s/g, '')}" ${!isEditable ? 'disabled style="background-color: #e9ecef; cursor: not-allowed;"' : ''}>
                                ${optionsHTML}
                            </select>
                        </div>
                    `;
                } else {
                    // Determine input type for other fields
                    if (field.includes('CTC') || field.includes('Years') || field.includes('Notice')) {
                        inputType = 'number';
                    } else if (field === 'Resume' || field === 'LinkedIn Profile') {
                        inputType = 'url';
                    }
                    
                    // Check if field is editable
                    const isEditable = editableFields === null || editableFields.includes(field);
                    const editableClass = isEditable ? 'editable-field' : 'readonly-field';
                    const cursorStyle = isEditable ? 'cursor: pointer;' : 'cursor: default;';

                    detailsHTML += `
                        <div class="candidate-detail-item" data-candidate-index="${index}" data-field-name="${field}" data-editable="${isEditable}">
                            <span class="candidate-detail-label">${field}:</span>
                            <span class="candidate-detail-value display-mode ${editableClass}" id="display-${field.replace(/\s/g, '')}" style="${cursorStyle}">${displayValue}</span>
                            <input type="${inputType}" class="form-control edit-mode" id="input-${field.replace(/\s/g, '')}" value="${displayValue}" style="display: none;" ${!isEditable ? 'readonly' : ''}>
                        </div>
                    `;
                }
            }
        }
    });

    // Add remaining fields (if any) for all users
    {
        Object.entries(candidate).forEach(([field, value]) => {
            if (!FIELD_ORDER.includes(field) && field !== 'Remarks') { // Exclude Remarks as it's handled separately
                let displayValue = formatFieldValue(field, value);
                let inputType = 'text';

                if (field === 'Timestamp') {
                    displayValue = new Date(value).toLocaleDateString();
                    detailsHTML += `
                        <div class="candidate-detail-item" data-candidate-index="${index}">
                            <span class="candidate-detail-label">${field}:</span>
                            <span class="candidate-detail-value">${displayValue}</span>
                        </div>
                    `;
                } else {
                    // Check if field is editable (for remaining fields, only editable if admin)
                    const isEditable = isAdmin;
                    const editableClass = isEditable ? 'editable-field' : 'readonly-field';
                    const cursorStyle = isEditable ? 'cursor: pointer;' : 'cursor: default;';
                    
                    detailsHTML += `
                        <div class="candidate-detail-item" data-candidate-index="${index}" data-field-name="${field}" data-editable="${isEditable}">
                            <span class="candidate-detail-label">${field}:</span>
                            <span class="candidate-detail-value display-mode ${editableClass}" id="display-${field.replace(/\s/g, '')}" style="${cursorStyle}">${displayValue}</span>
                            <input type="${inputType}" class="form-control edit-mode" id="input-${field.replace(/\s/g, '')}" value="${displayValue}" style="display: none;" ${!isEditable ? 'readonly' : ''}>
                        </div>
                    `;
                }
            }
        });
    }

    content.innerHTML = detailsHTML;

    // Add event listeners for inline editing
    document.querySelectorAll('.candidate-detail-item').forEach(item => {
        const displaySpan = item.querySelector('.candidate-detail-value');
        const editInput = item.querySelector('.edit-mode');
        const fieldName = item.querySelector('.candidate-detail-label').textContent.replace(':', '').trim();
        const isEditable = item.dataset.editable === 'true';
        const isStatusField = fieldName === 'Interview Status' || fieldName === 'Application Status';
        
        // Handle status fields (always visible as dropdowns)
        if (isStatusField) {
            const statusSelect = item.querySelector('select');
            if (statusSelect && isEditable) {
                // Only allow changes if editable (admin users)
                statusSelect.addEventListener('change', () => {
                    const newValue = statusSelect.value;
                    const candidateIndex = item.dataset.candidateIndex ?? index;
                    
                    const updatedCandidate = {};
                    updatedCandidate[fieldName] = newValue;
                    
                    fetch(`/api/data/${candidateIndex}`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(updatedCandidate),
                    })
                    .then(response => response.json())
                    .then(data => {
                        if (data.status === 'success') {
                            showToast('Candidate updated successfully!', 'success');
                            refreshData();
                        } else {
                            showToast(`Error updating candidate: ${data.message}`, 'danger');
                            // Revert dropdown value on error
                            statusSelect.value = candidate[fieldName] || '';
                        }
                    })
                    .catch(error => {
                        console.error('Error saving candidate:', error);
                        showToast('Error saving candidate.', 'danger');
                        // Revert dropdown value on error
                        statusSelect.value = candidate[fieldName] || '';
                    });
                });
            }
        } else {
            // Handle other fields with click-to-edit functionality
            // Allow inline editing only for editable fields
            if (displaySpan && editInput && isEditable) {
                displaySpan.addEventListener('click', (e) => {
                    // Don't trigger edit if clicking on a link (Resume/LinkedIn)
                    if (e.target.tagName === 'A' || e.target.closest('a')) {
                        return;
                    }
                    
                    displaySpan.style.display = 'none';
                    editInput.style.display = 'block';
                    editInput.removeAttribute('readonly');
                    editInput.removeAttribute('disabled');
                    editInput.focus();
                });

                editInput.addEventListener('blur', () => {
                    const newValue = editInput.value;
                    displaySpan.style.display = 'block';
                    editInput.style.display = 'none';
                    
                    // Update display value based on field type
                    if (fieldName === 'Resume' && newValue && newValue.toString().startsWith('http')) {
                        displaySpan.innerHTML = `<a href="${newValue}" target="_blank" class="btn btn-outline-primary btn-sm">
                            <i class="bi bi-file-earmark-pdf me-1"></i>View Resume
                        </a>`;
                    } else if (fieldName === 'LinkedIn Profile' && newValue && newValue.toString().startsWith('http')) {
                        displaySpan.innerHTML = `<a href="${newValue}" target="_blank" class="btn btn-outline-primary btn-sm">
                            <i class="bi bi-linkedin me-1"></i>View LinkedIn
                        </a>`;
                    } else {
                        displaySpan.textContent = newValue;
                    }

                    // Save single-field update on blur
                    const updatedCandidate = {};
                    updatedCandidate[fieldName] = newValue;
                    const candidateIndex = item.dataset.candidateIndex ?? index; // Retrieve candidate index

                    fetch(`/api/data/${candidateIndex}`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(updatedCandidate),
                    })
                    .then(response => response.json())
                    .then(data => {
                        if (data.status === 'success') {
                            showToast('Candidate updated successfully!', 'success');
                            refreshData();
                        } else {
                            showToast(`Error updating candidate: ${data.message}`, 'danger');
                        }
                    })
                    .catch(error => {
                        console.error('Error saving candidate:', error);
                        showToast('Error saving candidate.', 'danger');
                    });
                });
            }
        }
    });

    // Add Remarks section only if admin or 'Remarks' is part of user-visible columns
    if (isAdmin || fieldsToDisplay.includes('Remarks')) {
        const remarksSection = document.createElement('div');
        remarksSection.className = 'candidate-detail-item';
        remarksSection.innerHTML = `
            <span class="candidate-detail-label">Remarks:</span>
            <textarea id="candidateRemarks" class="form-control edit-mode" rows="3">${candidate.Remarks || ''}</textarea>
        `;
        content.appendChild(remarksSection);
    }

    // Get button references
    const editRemarksBtn = document.getElementById('editRemarksBtn');
    const saveRemarksBtn = document.getElementById('saveRemarksBtn');
    const candidateRemarks = document.getElementById('candidateRemarks');

    // Function to toggle edit mode for all fields
    function toggleEditMode(isEditing, isAdmin) {
        // Define editable fields for non-admin users
        const editableFieldsForUser = ['Initial Screening', 'Round 1 Remarks'];
        
        document.querySelectorAll('.candidate-detail-item').forEach(item => {
            const displaySpan = item.querySelector('.display-mode');
            const editInput = item.querySelector('.edit-mode');
            const selectInput = item.querySelector('select'); // For status dropdowns
            const isEditable = item.dataset.editable === 'true';
            const fieldLabel = item.querySelector('.candidate-detail-label');
            const fieldName = fieldLabel ? fieldLabel.textContent.replace(':', '').trim() : '';
            
            // For non-admin users, only allow editing of specific fields
            if (!isAdmin && !editableFieldsForUser.includes(fieldName)) {
                // Keep non-editable fields as read-only display
                if (displaySpan) {
                    displaySpan.style.display = 'block';
                }
                if (editInput) {
                    editInput.style.display = 'none';
                    editInput.setAttribute('readonly', true);
                }
                if (selectInput) {
                    selectInput.setAttribute('disabled', true);
                    selectInput.style.backgroundColor = '#e9ecef';
                    selectInput.style.cursor = 'not-allowed';
                }
                return; // Skip non-editable fields for non-admin users
            }
            
            // Handle editable fields
            if (displaySpan && editInput) {
                if (isEditing) {
                    displaySpan.style.display = 'none';
                    editInput.style.display = 'block';
                    editInput.removeAttribute('readonly');
                    editInput.removeAttribute('disabled');
                } else {
                    displaySpan.style.display = 'block';
                    editInput.style.display = 'none';
                    // Update display value based on field type
                    if (fieldName === 'Resume' && editInput.value && editInput.value.toString().startsWith('http')) {
                        displaySpan.innerHTML = `<a href="${editInput.value}" target="_blank" class="btn btn-outline-primary btn-sm">
                            <i class="bi bi-file-earmark-pdf me-1"></i>View Resume
                        </a>`;
                    } else if (fieldName === 'LinkedIn Profile' && editInput.value && editInput.value.toString().startsWith('http')) {
                        displaySpan.innerHTML = `<a href="${editInput.value}" target="_blank" class="btn btn-outline-primary btn-sm">
                            <i class="bi bi-linkedin me-1"></i>View LinkedIn
                        </a>`;
                    } else {
                        displaySpan.textContent = editInput.value;
                    }
                }
            } else if (selectInput) {
                // Handle status dropdowns - only editable for admin or if field is in editableFieldsForUser
                if (isEditing && (isAdmin || editableFieldsForUser.includes(fieldName))) {
                    selectInput.removeAttribute('disabled');
                    selectInput.style.backgroundColor = '';
                    selectInput.style.cursor = '';
                } else {
                    if (!isAdmin && !editableFieldsForUser.includes(fieldName)) {
                        selectInput.setAttribute('disabled', true);
                        selectInput.style.backgroundColor = '#e9ecef';
                        selectInput.style.cursor = 'not-allowed';
                    }
                }
            }
        });

        // Handle Remarks field separately (only if present)
        if (isEditing) {
            editRemarksBtn.style.display = 'none';
            saveRemarksBtn.style.display = 'block';
            if (candidateRemarks) {
                candidateRemarks.removeAttribute('readonly');
                candidateRemarks.focus();
            }
        } else {
            editRemarksBtn.style.display = 'block';
            saveRemarksBtn.style.display = 'none';
            if (candidateRemarks) {
                candidateRemarks.setAttribute('readonly', true);
            }
            // Implement logic to save all updated fields to the backend
            const updatedCandidate = {};
            document.querySelectorAll('.edit-mode').forEach(input => {
                const fieldName = input.id.replace('input-', '').replace(/([A-Z])/g, ' $1').trim(); // Convert 'FieldName' to 'Field Name'
                updatedCandidate[fieldName] = input.value;
            });
            if (candidateRemarks) {
                updatedCandidate.Remarks = candidateRemarks.value;
            }

            // Assuming the candidate object passed to showCandidateDetails has an 'originalIndex' or similar identifier
            // For now, we'll use the index from the global candidates array if available, or pass it from the table click event.
            // Let's assume for now that `candidate` object has an `id` or `index` property that can be used to identify it.
            // For this implementation, I'll assume the `candidate` object passed to `showCandidateDetails` has an `index` property.
            const candidateIndex = index; // This needs to be passed correctly from the table row click

            if (candidateIndex !== undefined) {
                fetch(`/api/data/${candidateIndex}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(updatedCandidate),
                })
                .then(response => response.json())
                .then(data => {
                    if (data.status === 'success') {
                        showToast('Candidate updated successfully!', 'success');
                        
                        bootstrap.Modal.getInstance(modal).hide(); // Close the modal
                        // Immediately refresh table so changes reflect without manual reload
                        refreshData();
                    } else {
                        showToast(`Error updating candidate: ${data.message}`, 'danger');
                    }
                })
                .catch(error => {
                    console.error('Error saving candidate:', error);
                    showToast('Error saving candidate.', 'danger');
                });
            } else {
                console.error('Candidate index not found for saving.');
                showToast('Error: Candidate index not found.', 'danger');
            }
        }
    }

    // Set initial button state
    editRemarksBtn.style.display = 'block';
    saveRemarksBtn.style.display = 'none';

    // Add event listeners for edit and save buttons
    editRemarksBtn.onclick = () => toggleEditMode(true, isAdmin);
    saveRemarksBtn.onclick = () => toggleEditMode(false, isAdmin);

    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
}

// Helper function to show toast notifications
function showToast(message, type) {
    const toastContainer = document.createElement('div');
    toastContainer.className = `toast position-fixed top-0 end-0 m-3 text-white bg-${type} border-0`;
    toastContainer.role = 'alert';
    toastContainer.ariaLive = 'assertive';
    toastContainer.ariaAtomic = 'true';
    toastContainer.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">
                ${message}
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
    `;
    document.body.appendChild(toastContainer);
    const toast = new bootstrap.Toast(toastContainer);
    toast.show();
    // Remove toast after it hides
    toastContainer.addEventListener('hidden.bs.toast', () => { 
        toastContainer.remove();
    });
}

// Helper to consistently format field values in candidate details
function formatFieldValue(field, value) {
    // Normalize date display for 'Date' and 'Timestamp' fields
    if ((field === 'Date' || field === 'Timestamp') && typeof value === 'string') {
        const datePart = value.split(' ')[0];
        try {
            return new Date(datePart).toLocaleDateString();
        } catch (e) {
            return datePart;
        }
    }
    if (value === null || value === undefined) return '—';
    if (Array.isArray(value)) {
        const joined = value.filter(Boolean).join(', ');
        return joined || '—';
    }
    if (typeof value === 'number') {
        if (!isFinite(value)) return '—';
        const currencyFields = ['Current CTC per Annum', 'Expected CTC per Annum', 'Offered CTC'];
        if (currencyFields.includes(field)) {
            return Number(value).toLocaleString('en-IN');
        }
        return String(value);
    }
    if (typeof value === 'string') {
        const v = value.trim();
        if (!v || ['nil', 'null', 'nan'].includes(v.toLowerCase())) return '—';
        return v;
    }
    try {
        return String(value);
    } catch (e) {
        return '—';
    }
}