document.addEventListener('DOMContentLoaded', () => {
    // Tab handling
    const tabs = document.querySelectorAll('.tab');
    const tabContents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetId = tab.getAttribute('data-tab');
            
            // Update active tab
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Show corresponding content
            tabContents.forEach(content => {
                content.classList.remove('active');
                if (content.id === targetId) {
                    content.classList.add('active');
                }
            });
        });
    });

    // File upload handling
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const processButton = document.getElementById('processButton');
    const uploadSuccess = document.getElementById('uploadSuccess');
    const uploadError = document.getElementById('uploadError');

    // Make file input visible and styled
    fileInput.style.display = 'block';
    fileInput.style.opacity = '0';
    fileInput.style.position = 'absolute';
    fileInput.style.width = '100%';
    fileInput.style.height = '100%';
    fileInput.style.cursor = 'pointer';

    dropZone.addEventListener('click', (e) => {
        if (e.target === dropZone || e.target.tagName !== 'BUTTON') {
            fileInput.click();
        }
    });

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('drag-over');
        
        const file = e.dataTransfer.files[0];
        if (file && file.name.endsWith('.csv')) {
            handleFileUpload(file);
            // Update the file input value for consistency
            fileInput.files = e.dataTransfer.files;
        } else {
            showError('Please upload a CSV file');
        }
    });

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.name.endsWith('.csv')) {
                handleFileUpload(file);
            } else {
                showError('Please upload a CSV file');
                e.target.value = '';
            }
        }
    });

    async function handleFileUpload(file) {
        const formData = new FormData();
        formData.append('file', file);

        try {
            console.log('Uploading file:', file.name);
            const response = await fetch('http://localhost:8000/upload-data/', {
                method: 'POST',
                body: formData
            });

            console.log('Response status:', response.status);
            const responseData = await response.json();
            console.log('Response data:', responseData);

            if (response.ok) {
                showSuccess('File uploaded successfully!');
                processButton.style.display = 'block';
            } else {
                showError(responseData.detail || 'Error uploading file');
            }
        } catch (error) {
            console.error('Upload error:', error);
            showError('Network error. Please try again.');
        }
    }

    processButton.addEventListener('click', async () => {
        try {
            showSpinner();
            const response = await fetch('http://localhost:8000/segment-customers/', {
                method: 'POST'
            });

            if (response.ok) {
                const data = await response.json();
                displayResults(data.insights);
                
                // Get additional segment analysis
                const analysisResponse = await fetch('http://localhost:8000/segment-analysis/');
                if (analysisResponse.ok) {
                    const analysisData = await analysisResponse.json();
                    displaySegmentAnalysis(analysisData);
                }
                
                // Switch to results tab
                document.querySelector('[data-tab="results"]').click();
            } else {
                const error = await response.json();
                showError(error.detail || 'Error processing data');
            }
        } catch (error) {
            showError('Network error. Please try again.');
        } finally {
            hideSpinner();
        }
    });

    // Individual customer form handling
    const customerForm = document.getElementById('customerForm');

    customerForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const customerData = {
            age: parseInt(document.getElementById('age').value),
            gender: document.getElementById('gender').value,
            income: parseFloat(document.getElementById('income').value),
            purchase_frequency: parseFloat(document.getElementById('purchaseFrequency').value),
            last_purchase: parseInt(document.getElementById('lastPurchase').value),
            avg_time_spent: parseFloat(document.getElementById('avgTimeSpent').value),
            preferred_category: document.getElementById('preferredCategory').value,
            visits_per_month: parseFloat(document.getElementById('purchaseFrequency').value), // Derive from purchase frequency
            avg_order_value: parseFloat(document.getElementById('income').value) / 
                (parseFloat(document.getElementById('purchaseFrequency').value) + 1), // Derive from income and frequency
            customer_lifetime_value: parseFloat(document.getElementById('income').value) * 
                (parseFloat(document.getElementById('purchaseFrequency').value) + 1) // Derive from income and frequency
        };

        try {
            showSpinner();
            const response = await fetch('http://localhost:8000/predict-segment/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(customerData)
            });

            if (response.ok) {
                const data = await response.json();
                displayIndividualResult(data);
                // Switch to results tab
                document.querySelector('[data-tab="results"]').click();
            } else {
                const error = await response.json();
                showError(error.detail || 'Error predicting segment');
            }
        } catch (error) {
            console.error('Prediction error:', error);
            showError('Network error. Please try again.');
        } finally {
            hideSpinner();
        }
    });

    // Chart.js defaults
    Chart.defaults.font.family = "'Inter', sans-serif";
    Chart.defaults.color = '#2c3e50';
    Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(44, 62, 80, 0.9)';

    let charts = {
        segmentPie: null,
        ageBar: null,
        incomeBox: null,
        purchaseScatter: null
    };

    function createCharts(data) {
        // Segment Distribution Pie Chart
        const segmentCtx = document.getElementById('segmentPieChart').getContext('2d');
        charts.segmentPie = new Chart(segmentCtx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(data.insights.segment_profiles).map(segment => 
                    data.insights.segment_profiles[segment].label
                ),
                datasets: [{
                    data: Object.values(data.insights.segment_sizes),
                    backgroundColor: [
                        '#4a90e2',
                        '#2ecc71',
                        '#e74c3c',
                        '#f1c40f',
                        '#9b59b6'
                    ]
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });

        // Age Distribution Bar Chart
        const ageCtx = document.getElementById('ageBarChart').getContext('2d');
        const ageData = processAgeData(data);
        charts.ageBar = new Chart(ageCtx, {
            type: 'bar',
            data: {
                labels: ageData.labels,
                datasets: ageData.datasets
            },
            options: {
                responsive: true,
                scales: {
                    x: {
                        stacked: true,
                        title: {
                            display: true,
                            text: 'Age Groups'
                        }
                    },
                    y: {
                        stacked: true,
                        title: {
                            display: true,
                            text: 'Number of Customers'
                        }
                    }
                }
            }
        });

        // Income Distribution Bar Chart
        const incomeCtx = document.getElementById('incomeBoxPlot').getContext('2d');
        const incomeData = processIncomeData(data);
        charts.incomeBox = new Chart(incomeCtx, {
            type: 'bar',
            data: {
                labels: Object.keys(data.insights.segment_profiles).map(segment => 
                    data.insights.segment_profiles[segment].label
                ),
                datasets: [{
                    label: 'Average Income',
                    data: Object.values(data.insights.segment_profiles).map(profile => 
                        profile.avg_metrics.income
                    ),
                    backgroundColor: 'rgba(74, 144, 226, 0.5)',
                    borderColor: '#4a90e2',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Income'
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `$${context.parsed.y.toLocaleString()}`;
                            }
                        }
                    }
                }
            }
        });

        // Purchase Patterns Scatter Plot
        if (data.insights.segment_profiles[0].avg_metrics.purchase_frequency) {
            const purchaseCtx = document.getElementById('purchaseScatterPlot').getContext('2d');
            const purchaseData = processPurchaseData(data);
            charts.purchaseScatter = new Chart(purchaseCtx, {
                type: 'scatter',
                data: {
                    datasets: purchaseData
                },
                options: {
                    responsive: true,
                    scales: {
                        x: {
                            title: {
                                display: true,
                                text: 'Purchase Frequency'
                            }
                        },
                        y: {
                            title: {
                                display: true,
                                text: 'Average Purchase Value'
                            }
                        }
                    }
                }
            });
        }

        // Display model metrics
        displayModelMetrics(data.model_performance);

        // Display segment transitions if available
        if (data.insights.segment_transitions) {
            displayTransitionMatrix(data.insights.segment_transitions);
        }
    }

    function processAgeData(data) {
        const ageGroups = ['Young', 'Young Adult', 'Adult', 'Senior', 'Elder'];
        const segments = Object.keys(data.insights.segment_profiles);
        
        return {
            labels: ageGroups,
            datasets: segments.map((segment, index) => ({
                label: data.insights.segment_profiles[segment].label,
                data: ageGroups.map(() => Math.random() * 100), // Replace with actual data
                backgroundColor: getSegmentColor(index),
                stack: 'Stack 0'
            }))
        };
    }

    function processIncomeData(data) {
        return Object.values(data.insights.segment_profiles).map(profile => ({
            min: profile.avg_metrics.income * 0.5,
            q1: profile.avg_metrics.income * 0.75,
            median: profile.avg_metrics.income,
            q3: profile.avg_metrics.income * 1.25,
            max: profile.avg_metrics.income * 1.5
        }));
    }

    function processPurchaseData(data) {
        return Object.entries(data.insights.segment_profiles).map(([segment, profile], index) => ({
            label: profile.label,
            data: [{
                x: profile.avg_metrics.purchase_frequency,
                y: profile.avg_metrics.avg_purchase_value || 0
            }],
            backgroundColor: getSegmentColor(index)
        }));
    }

    function displayModelMetrics(performance) {
        const metricsDiv = document.getElementById('modelMetrics');
        metricsDiv.innerHTML = `
            <div class="metric-card">
                <div class="metric-value">${performance.algorithm}</div>
                <div class="metric-label">Algorithm</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${(performance.silhouette_score * 100).toFixed(1)}%</div>
                <div class="metric-label">Silhouette Score</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${(performance.explained_variance * 100).toFixed(1)}%</div>
                <div class="metric-label">Explained Variance</div>
            </div>
        `;
    }

    function displayTransitionMatrix(transitions) {
        const table = document.getElementById('transitionMatrix');
        const segments = Object.keys(transitions);
        
        let html = '<tr><th>From / To</th>';
        segments.forEach(segment => {
            html += `<th>Segment ${segment}</th>`;
        });
        html += '</tr>';
        
        segments.forEach(fromSegment => {
            html += `<tr><td>Segment ${fromSegment}</td>`;
            segments.forEach(toSegment => {
                const value = (transitions[fromSegment][toSegment] * 100).toFixed(1);
                html += `<td>${value}%</td>`;
            });
            html += '</tr>';
        });
        
        table.innerHTML = html;
    }

    function getSegmentColor(index) {
        const colors = [
            '#4a90e2',
            '#2ecc71',
            '#e74c3c',
            '#f1c40f',
            '#9b59b6'
        ];
        return colors[index % colors.length];
    }

    function displayResults(insights) {
        const resultsDiv = document.getElementById('segmentResults');
        let html = '<h3>Segment Analysis</h3>';

        // Display segment sizes
        html += '<div class="segment-card">';
        html += '<div class="segment-title">Segment Distribution</div>';
        html += '<div class="segment-stats">';
        
        for (const [segment, count] of Object.entries(insights.segment_sizes)) {
            html += `
                <div class="stat-item">
                    <div class="stat-label">Segment ${segment}</div>
                    <div class="stat-value">${count} customers</div>
                </div>
            `;
        }
        html += '</div></div>';

        // Display segment profiles
        for (const [segment, profile] of Object.entries(insights.segment_profiles)) {
            html += `
                <div class="segment-card">
                    <div class="segment-title">${segment}</div>
                    <div class="segment-stats">
                        <div class="stat-item">
                            <div class="stat-label">Size</div>
                            <div class="stat-value">${profile.size} customers</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-label">Percentage</div>
                            <div class="stat-value">${profile.percentage}%</div>
                        </div>
                    </div>
                    <div class="segment-title">Average Metrics</div>
                    <div class="segment-stats">
            `;

            for (const [metric, value] of Object.entries(profile.avg_metrics)) {
                html += `
                    <div class="stat-item">
                        <div class="stat-label">${formatMetricName(metric)}</div>
                        <div class="stat-value">${formatMetricValue(metric, value)}</div>
                    </div>
                `;
            }

            html += '</div></div>';
        }

        resultsDiv.innerHTML = html;
        createCharts({ insights });
        document.querySelector('[data-tab="analytics"]').click();
    }

    function displayIndividualResult(data) {
        const resultsDiv = document.getElementById('segmentResults');
        let html = `
            <div class="segment-card">
                <div class="segment-title">Customer Segment Prediction</div>
                <div class="segment-stats">
                    <div class="stat-item">
                        <div class="stat-label">Predicted Segment</div>
                        <div class="stat-value">${data.segment_label}</div>
                    </div>
                </div>
                
                <div class="segment-title">Customer Information</div>
                <div class="segment-stats">
        `;

        // Display customer data
        for (const [key, value] of Object.entries(data.customer_data)) {
            if (value !== null) {
                html += `
                    <div class="stat-item">
                        <div class="stat-label">${formatMetricName(key)}</div>
                        <div class="stat-value">${formatMetricValue(key, value)}</div>
                    </div>
                `;
            }
        }

        html += '</div>';

        // Display segment characteristics
        if (data.segment_characteristics.avg_metrics) {
            html += `
                <div class="segment-title">Segment Profile</div>
                <div class="segment-stats">
                    <div class="stat-item">
                        <div class="stat-label">Segment Size</div>
                        <div class="stat-value">${data.segment_characteristics.size} customers (${data.segment_characteristics.percentage}%)</div>
                    </div>
                </div>
                
                <div class="segment-title">Average Metrics</div>
                <div class="segment-stats">
            `;

            for (const [key, value] of Object.entries(data.segment_characteristics.avg_metrics)) {
                html += `
                    <div class="stat-item">
                        <div class="stat-label">${formatMetricName(key)}</div>
                        <div class="stat-value">${formatMetricValue(key, value)}</div>
                    </div>
                `;
            }

            html += '</div>';

            // Display distinctive characteristics
            if (Object.keys(data.segment_characteristics.characteristics).length > 0) {
                html += `
                    <div class="segment-title">Distinctive Characteristics</div>
                    <div class="segment-stats">
                `;

                for (const [key, value] of Object.entries(data.segment_characteristics.characteristics)) {
                    html += `
                        <div class="stat-item">
                            <div class="stat-label">${formatMetricName(key)}</div>
                            <div class="stat-value">${value.difference.toFixed(1)}% ${value.direction} than average</div>
                        </div>
                    `;
                }

                html += '</div>';
            }
        }

        html += '</div>';
        resultsDiv.innerHTML = html;
    }

    function displaySegmentAnalysis(data) {
        const analyticsDiv = document.getElementById('modelMetrics');
        let html = `
            <div class="metric-card">
                <div class="metric-value">${data.total_customers}</div>
                <div class="metric-label">Total Customers</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${data.number_of_segments}</div>
                <div class="metric-label">Number of Segments</div>
            </div>
        `;

        // Add segment statistics
        for (const [segment, stats] of Object.entries(data.segment_statistics)) {
            html += `
                <div class="segment-card">
                    <div class="segment-title">${segment}</div>
                    <div class="segment-stats">
                        <div class="stat-item">
                            <div class="stat-label">Size</div>
                            <div class="stat-value">${stats.size} (${stats.percentage.toFixed(1)}%)</div>
                        </div>
                    </div>
                    
                    <div class="segment-title">Key Metrics</div>
                    <div class="segment-stats">
            `;

            // Display numeric statistics
            for (const [metric, values] of Object.entries(stats.numeric_stats)) {
                html += `
                    <div class="stat-item">
                        <div class="stat-label">${formatMetricName(metric)}</div>
                        <div class="stat-value">
                            Mean: ${formatMetricValue(metric, values.mean)}<br>
                            Median: ${formatMetricValue(metric, values.median)}
                        </div>
                    </div>
                `;
            }

            html += '</div></div>';
        }

        // Display transition matrix if available
        if (data.segment_transitions) {
            html += `
                <div class="segment-card">
                    <div class="segment-title">Segment Transitions</div>
                    <div class="table-container">
                        <table class="transition-matrix">
                            <tr>
                                <th>From / To</th>
                                ${Object.keys(data.segment_transitions[Object.keys(data.segment_transitions)[0]]).map(to => 
                                    `<th>Segment ${to}</th>`
                                ).join('')}
                            </tr>
            `;

            for (const [from, transitions] of Object.entries(data.segment_transitions)) {
                html += `
                    <tr>
                        <td>Segment ${from}</td>
                        ${Object.values(transitions).map(value => 
                            `<td>${(value * 100).toFixed(1)}%</td>`
                        ).join('')}
                    </tr>
                `;
            }

            html += '</table></div></div>';
        }

        analyticsDiv.innerHTML = html;
    }

    function formatMetricName(metric) {
        return metric
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    function formatMetricValue(metric, value) {
        if (metric.includes('income')) {
            return `$${value.toLocaleString()}`;
        }
        if (metric.includes('age')) {
            return `${value} years`;
        }
        if (metric.includes('frequency')) {
            return `${value}/year`;
        }
        if (metric.includes('last_purchase')) {
            return `${value} days`;
        }
        return value;
    }

    function showSpinner() {
        document.querySelector('.spinner').style.display = 'block';
    }

    function hideSpinner() {
        document.querySelector('.spinner').style.display = 'none';
    }

    function showSuccess(message) {
        uploadSuccess.textContent = message;
        uploadSuccess.style.display = 'block';
        uploadError.style.display = 'none';
        setTimeout(() => {
            uploadSuccess.style.display = 'none';
        }, 5000);
    }

    function showError(message) {
        uploadError.textContent = message;
        uploadError.style.display = 'block';
        uploadSuccess.style.display = 'none';
        setTimeout(() => {
            uploadError.style.display = 'none';
        }, 5000);
    }
}); 