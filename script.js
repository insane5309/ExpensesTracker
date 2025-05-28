

class ExpenseTracker {
    constructor() {
        this.API_BASE_URL = 'http://localhost:3000/api';
        // this.API_BASE_URL = 'https://expensetracker-uhcb.onrender.com/api';
        this.expenses = [];
        this.isLoading = false;
        
        
        this.elements = {
            form: document.getElementById('expense-form'),
            typeField: document.getElementById('type'),
            commentBox: document.getElementById('comment'),
            expenseTableBody: document.querySelector('#expense-table tbody'),
            filterTypeSelect: document.getElementById('filter-type'),
            filterMonthSelect: document.getElementById('filter-month'),
            downloadButton: document.getElementById('download-csv')
        };
        
        this.init();
    }


    async init() {
        this.bindEvents();
        await this.fetchExpenses();
    }


    bindEvents() {
        
        this.elements.form.addEventListener('submit', this.handleFormSubmit.bind(this));
        
        
        this.elements.typeField.addEventListener('change', this.handleTypeChange.bind(this));
        
        
        this.elements.filterTypeSelect.addEventListener('change', this.handleFilterChange.bind(this));
        this.elements.filterMonthSelect.addEventListener('change', this.handleFilterChange.bind(this));
        
        
        this.elements.downloadButton.addEventListener('click', this.downloadCSV.bind(this));
    }


    setLoading(isLoading) {
        this.isLoading = isLoading;
        const submitButton = this.elements.form.querySelector('button[type="submit"]');
        if (submitButton) {
            submitButton.disabled = isLoading;
            submitButton.textContent = isLoading ? 'Adding...' : 'Add Expense';
        }
    }


    showError(message) {
        console.error('Error:', message);
        
        alert(`Error: ${message}`);
    }


    showSuccess(message) {
        console.log('Success:', message);
        
    }

    async fetchExpenses() {
        try {
            this.setLoading(true);
            const response = await fetch(`${this.API_BASE_URL}/expenses`);
            
            if (!response.ok) {
                throw new Error(`Failed to fetch expenses: ${response.status} ${response.statusText}`);
            }
            
            this.expenses = await response.json();
            this.updateUI();
            this.showSuccess('Expenses loaded successfully');
            
        } catch (error) {
            this.showError(`Failed to load expenses: ${error.message}`);
        } finally {
            this.setLoading(false);
        }
    }


    async addExpense(expenseData) {
        try {
            this.setLoading(true);
            const response = await fetch(`${this.API_BASE_URL}/expenses`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(expenseData)
            });

            if (!response.ok) {
                throw new Error(`Failed to add expense: ${response.status} ${response.statusText}`);
            }

            const newExpense = await response.json();
            this.expenses.push(newExpense);
            this.updateUI();
            this.showSuccess('Expense added successfully');
            
        } catch (error) {
            this.showError(`Failed to add expense: ${error.message}`);
        } finally {
            this.setLoading(false);
        }
    }


    async removeExpense(expenseId, index) {
        try {
            const response = await fetch(`${this.API_BASE_URL}/expenses/${expenseId}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                throw new Error(`Failed to delete expense: ${response.status} ${response.statusText}`);
            }

            this.expenses.splice(index, 1);
            this.updateUI();
            this.showSuccess('Expense removed successfully');
            
        } catch (error) {
            this.showError(`Failed to remove expense: ${error.message}`);
        }
    }


    async handleFormSubmit(event) {
        event.preventDefault();
        
        if (this.isLoading) return;

        const formData = new FormData(this.elements.form);
        const expenseData = {
            date: formData.get('date') || document.getElementById('date').value,
            type: this.elements.typeField.value,
            amount: parseFloat(document.getElementById('amount').value),
            comment: this.elements.typeField.value === 'Miscellaneous' 
                ? document.getElementById('comment').value.trim() 
                : ''
        };

        
        if (!this.validateExpenseData(expenseData)) {
            return;
        }

        await this.addExpense(expenseData);
        
        
        if (!this.isLoading) {
            this.elements.form.reset();
            this.elements.commentBox.style.display = 'none';
        }
    }


    validateExpenseData(data) {
        if (!data.date) {
            this.showError('Please select a date');
            return false;
        }
        
        if (!data.type) {
            this.showError('Please select an expense type');
            return false;
        }
        
        if (!data.amount || data.amount <= 0) {
            this.showError('Please enter a valid amount');
            return false;
        }
        
        return true;
    }


    handleTypeChange() {
        const isMiscellaneous = this.elements.typeField.value === 'Miscellaneous';
        this.elements.commentBox.style.display = isMiscellaneous ? 'block' : 'none';
        
        if (isMiscellaneous) {
            this.elements.commentBox.focus();
        }
    }


    handleFilterChange() {
        const selectedType = this.elements.filterTypeSelect.value;
        const selectedMonth = this.elements.filterMonthSelect.value;
        
        if (selectedType && selectedMonth) {
            this.drawTrendChart(selectedType, selectedMonth);
        }
    }


    updateUI() {
        this.renderExpenseTable();
        this.populateFilters();
        this.updateCharts();
    }


    renderExpenseTable() {
        if (!this.elements.expenseTableBody) return;
        
        this.elements.expenseTableBody.innerHTML = '';

        if (this.expenses.length === 0) {
            const tr = document.createElement('tr');
            tr.innerHTML = '<td colspan="5" style="text-align: center; padding: 2rem; color: #666;">No expenses found</td>';
            this.elements.expenseTableBody.appendChild(tr);
            return;
        }

        this.expenses.forEach((expense, index) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${this.formatDate(expense.date)}</td>
                <td>${this.escapeHtml(expense.type)}</td>
                <td>₹${Number(expense.amount).toFixed(2)}</td>
                <td>${this.escapeHtml(expense.comment || '-')}</td>
                <td>
                    <button class="remove-btn" data-id="${expense.id}" data-index="${index}">
                        Remove
                    </button>
                </td>
            `;
            this.elements.expenseTableBody.appendChild(tr);
        });

        
        this.elements.expenseTableBody.querySelectorAll('.remove-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const expenseId = e.target.dataset.id;
                const index = parseInt(e.target.dataset.index);
                
                if (confirm('Are you sure you want to remove this expense?')) {
                    this.removeExpense(expenseId, index);
                }
            });
        });
    }

    populateFilters() {
        if (this.expenses.length === 0) return;

        const types = [...new Set(this.expenses.map(expense => expense.type))].sort();
        this.elements.filterTypeSelect.innerHTML = '';
        
        types.forEach(type => {
            const option = document.createElement('option');
            option.value = type;
            option.textContent = type;
            this.elements.filterTypeSelect.appendChild(option);
        });

        
        const months = [...new Set(this.expenses.map(expense => 
            d3.timeFormat("%Y-%m")(new Date(expense.date))
        ))].sort();
        
        this.elements.filterMonthSelect.innerHTML = '';
        
        months.forEach(month => {
            const option = document.createElement('option');
            option.value = month;
            option.textContent = month;
            this.elements.filterMonthSelect.appendChild(option);
        });

        
        const currentMonth = d3.timeFormat("%Y-%m")(new Date());
        if (months.includes(currentMonth)) {
            this.elements.filterMonthSelect.value = currentMonth;
        } else if (months.length > 0) {
            this.elements.filterMonthSelect.value = months[months.length - 1];
        }

        
        if (types.length > 0) {
            this.elements.filterTypeSelect.value = types[0];
        }
    }

    updateCharts() {
        if (this.expenses.length === 0) return;
        
        this.drawMonthlyBarChart();
        
        const selectedType = this.elements.filterTypeSelect.value;
        const selectedMonth = this.elements.filterMonthSelect.value;
        
        if (selectedType && selectedMonth) {
            this.drawTrendChart(selectedType, selectedMonth);
        }
    }


    drawMonthlyBarChart() {
        const chartContainer = d3.select("#monthlyChart");
        chartContainer.selectAll("*").remove();

        if (this.expenses.length === 0) {
            chartContainer.append("p").text("No data available for chart");
            return;
        }

        const expensesParsed = this.expenses.map(d => ({
            ...d,
            date: new Date(d.date)
        }));

        const currentYear = new Date().getFullYear();
        const allMonths = d3.timeMonths(
            new Date(currentYear, 0, 1), 
            new Date(currentYear + 1, 0, 1)
        ).map(d => d3.timeFormat("%Y-%m")(d));

        const types = [...new Set(this.expenses.map(d => d.type))];

        
        const nested = d3.rollup(
            expensesParsed,
            v => d3.rollup(v, vv => d3.sum(vv, d => d.amount), d => d.type),
            d => d3.timeFormat("%Y-%m")(d.date)
        );

        const data = allMonths.map(month => {
            const typeData = nested.get(month) || new Map();
            const monthData = { month };
            types.forEach(type => {
                monthData[type] = typeData.get(type) || 0;
            });
            return monthData;
        });

        const stack = d3.stack().keys(types);
        const stackedData = stack(data);

        
        const margin = { top: 40, right: 150, bottom: 60, left: 60 };
        const width = 900;
        const height = 450;

        const svg = chartContainer
            .append("svg")
            .attr("viewBox", `0 0 ${width} ${height}`)
            .attr("preserveAspectRatio", "xMidYMid meet");

        
        const x = d3.scaleBand()
            .domain(allMonths)
            .range([margin.left, width - margin.right])
            .padding(0.1);

        const y = d3.scaleLinear()
            .domain([0, d3.max(data, d => d3.sum(types, type => d[type]))])
            .nice()
            .range([height - margin.bottom, margin.top]);

        const color = d3.scaleOrdinal(d3.schemeCategory10).domain(types);

        
        const tooltip = chartContainer
            .append("div")
            .attr("class", "chart-tooltip")
            .style("position", "absolute")
            .style("padding", "8px 12px")
            .style("background", "rgba(0, 0, 0, 0.8)")
            .style("color", "white")
            .style("border-radius", "4px")
            .style("font-size", "12px")
            .style("pointer-events", "none")
            .style("opacity", 0);

        
        svg.append("g")
            .attr("transform", `translate(0,${height - margin.bottom})`)
            .call(d3.axisBottom(x).tickFormat(d => 
                d3.timeFormat("%b")(d3.timeParse("%Y-%m")(d))
            ))
            .selectAll("text")
            .attr("transform", "rotate(-45)")
            .style("text-anchor", "end");

        svg.append("g")
            .attr("transform", `translate(${margin.left},0)`)
            .call(d3.axisLeft(y));

        
        svg.selectAll("g.layer")
            .data(stackedData)
            .enter()
            .append("g")
            .attr("class", "layer")
            .attr("fill", d => color(d.key))
            .selectAll("rect")
            .data(d => d.map(p => ({ ...p, key: d.key })))
            .enter()
            .append("rect")
            .attr("x", d => x(d.data.month))
            .attr("y", d => y(d[1]))
            .attr("height", d => y(d[0]) - y(d[1]))
            .attr("width", x.bandwidth())
            .on("mouseover", (event, d) => {
                tooltip.transition().duration(200).style("opacity", 1);
                tooltip.html(`
                    <strong>${d.key}</strong><br/>
                    ${d.data.month}<br/>
                    ₹${(d[1] - d[0]).toFixed(2)}
                `)
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 10) + "px");
            })
            .on("mouseout", () => {
                tooltip.transition().duration(300).style("opacity", 0);
            });

        
        const legend = svg.append("g")
            .attr("transform", `translate(${width - margin.right + 10}, ${margin.top})`);

        types.forEach((type, i) => {
            const legendRow = legend.append("g")
                .attr("transform", `translate(0, ${i * 20})`);

            legendRow.append("rect")
                .attr("width", 14)
                .attr("height", 14)
                .attr("fill", color(type));

            legendRow.append("text")
                .attr("x", 20)
                .attr("y", 12)
                .style("font-size", "12px")
                .text(type);
        });
    }

    drawTrendChart(selectedType, selectedMonth) {
        const chartContainer = d3.select("#trendChart");
        chartContainer.selectAll("*").remove();

        const filteredExpenses = this.expenses.filter(expense => {
            const expenseMonth = d3.timeFormat("%Y-%m")(new Date(expense.date));
            return expenseMonth === selectedMonth && expense.type === selectedType;
        });

        if (filteredExpenses.length === 0) {
            chartContainer.append("p").text(`No data for ${selectedType} in ${selectedMonth}`);
            return;
        }

        
        const expensesByDay = d3.group(filteredExpenses, d => 
            parseInt(d3.timeFormat("%d")(new Date(d.date)))
        );

        const dailyTotals = Array.from(expensesByDay, ([day, expenses]) => ({
            day,
            total: d3.sum(expenses, d => d.amount),
            expenses
        })).sort((a, b) => a.day - b.day);

        
        const margin = { top: 30, right: 30, bottom: 40, left: 60 };
        const width = 800;
        const height = 400;

        const svg = chartContainer
            .append("svg")
            .attr("viewBox", `0 0 ${width} ${height}`)
            .attr("preserveAspectRatio", "xMidYMid meet");

        
        const x = d3.scaleLinear()
            .domain([1, 31])
            .range([margin.left, width - margin.right]);

        const y = d3.scaleLinear()
            .domain([0, d3.max(dailyTotals, d => d.total) || 1])
            .nice()
            .range([height - margin.bottom, margin.top]);

        
        svg.append("g")
            .attr("transform", `translate(0,${height - margin.bottom})`)
            .call(d3.axisBottom(x).ticks(31));

        svg.append("g")
            .attr("transform", `translate(${margin.left},0)`)
            .call(d3.axisLeft(y));

        
        const line = d3.line()
            .x(d => x(d.day))
            .y(d => y(d.total))
            .curve(d3.curveMonotoneX);

        svg.append("path")
            .datum(dailyTotals)
            .attr("fill", "none")
            .attr("stroke", "#2c3e50")
            .attr("stroke-width", 2)
            .attr("d", line);

        
        const tooltip = chartContainer
            .append("div")
            .attr("class", "chart-tooltip")
            .style("position", "absolute")
            .style("padding", "8px 12px")
            .style("background", "rgba(0, 0, 0, 0.8)")
            .style("color", "white")
            .style("border-radius", "4px")
            .style("font-size", "12px")
            .style("pointer-events", "none")
            .style("opacity", 0);

        
        svg.selectAll("circle")
            .data(dailyTotals)
            .enter()
            .append("circle")
            .attr("cx", d => x(d.day))
            .attr("cy", d => y(d.total))
            .attr("r", 4)
            .attr("fill", "#e74c3c")
            .attr("stroke", "#fff")
            .attr("stroke-width", 2)
            .on("mouseover", (event, d) => {
                tooltip.transition().duration(200).style("opacity", 1);
                const details = d.expenses
                    .map(exp => `₹${exp.amount}${exp.comment ? ` (${exp.comment})` : ''}`)
                    .join('<br/>');
                
                tooltip.html(`
                    <strong>Day ${d.day}</strong><br/>
                    Total: ₹${d.total.toFixed(2)}<br/>
                    ${details}
                `)
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 10) + "px");
            })
            .on("mouseout", () => {
                tooltip.transition().duration(300).style("opacity", 0);
            });
    }

    downloadCSV() {
        if (this.expenses.length === 0) {
            this.showError("No expense data to download");
            return;
        }

        const headers = ['Date', 'Type', 'Amount (₹)', 'Comment'];
        const csvRows = this.expenses.map(expense => [
            expense.date,
            `"${expense.type.replace(/"/g, '""')}"`,
            expense.amount,
            `"${(expense.comment || '').replace(/"/g, '""')}"`
        ]);

        const csvContent = [
            headers.join(','),
            ...csvRows.map(row => row.join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `expenses_${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }
    }

    
    formatDate(dateString) {
        return new Date(dateString).toLocaleDateString('en-IN');
    }


    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    async uploadFile(event) {
  event.preventDefault();

  const fileInput = document.getElementById('pdfInput');
  const file = fileInput.files[0];

  if (!file) {
    alert('Please select a PDF file.');
    return;
  }

  const formData = new FormData();
  formData.append('pdf', file);

  try {
    const response = await fetch('/upload', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error('Failed to extract data from PDF.');
    }

    const result = await response.json();
    document.getElementById('output').textContent = JSON.stringify(result, null, 2);
    alert(result);
      console.log(result);
  } catch (err) {
    document.getElementById('output').textContent = 'Error: ' + err.message;
  }
};

}

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("uploadForm");
  const fileInput = document.getElementById("pdfInput");

  form.addEventListener("submit", (event) => {
    event.preventDefault(); // Prevent actual form submission

    const file = fileInput.files[0];
    if (!file || file.type !== "application/pdf") {
      alert("Please select a valid PDF file.");
      return;
    }

    uploadFile(file); // Call your upload logic
  });
});

document.addEventListener('DOMContentLoaded', () => {
    new ExpenseTracker();
});
