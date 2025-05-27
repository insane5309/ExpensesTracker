const form = document.getElementById('expense-form');
const typeField = document.getElementById('type');
const commentBox = document.getElementById('comment');
const expenseTableBody = document.querySelector('#expense-table tbody');

const filterTypeSelect = document.getElementById('filter-type');
const filterMonthSelect = document.getElementById('filter-month');
const link = `https://expensetracker-uhcb.onrender.com/api`;

let expenses = [];
fetchExpenses();

// Fetch expenses from the API
async function fetchExpenses() {
  try {
    const response = await fetch(`${link}/expenses`);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    expenses = await response.json();
    renderExpenseTable();
    populateFilters();
    updateCharts();
  } catch (error) {
    console.error('Error fetching expenses:', error);
  }
}

// Add a new expense via the API
async function addExpense(expense) {
  try {
    const response = await fetch(`${link}/expenses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(expense)
    });
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    const newExpense = await response.json();
    expenses.push(newExpense);
    renderExpenseTable();
    updateCharts();
    populateFilters();
  } catch (error) {
    console.error('Error adding expense:', error);
  }
}

// Remove an expense via the API
async function removeExpense(index) {
  const expense = expenses[index];
  try {
    const response = await fetch(`${link}/expenses/${expense.id}`, {
      method: 'DELETE'
    });
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    expenses.splice(index, 1);
    renderExpenseTable();
    updateCharts();
    populateFilters();
  } catch (error) {
    console.error('Error removing expense:', error);
  }
}

document.getElementById('download-csv').addEventListener('click', () => {
  if (expenses.length === 0) {
    alert("No expense data to download.");
    return;
  }

  const csvHeaders = ['Date', 'Type', 'Amount (₹)', 'Comment'];
  const csvRows = expenses.map(exp => [
    exp.date,
    exp.type,
    exp.amount,
    `"${(exp.comment || '').replace(/"/g, '""')}"`
  ]);

  const csvContent = [
    csvHeaders.join(','),             // header row
    ...csvRows.map(row => row.join(',')) // data rows
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'expenses.csv';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
});

function populateFilters() {
  // Get unique types
  filterTypeSelect.innerHTML = ''; // Clear existing options
  const types = Array.from(new Set(expenses.map(d => d.type)));
  types.forEach(t => {
    const option = document.createElement('option');
    option.value = t;
    option.textContent = t; // Automatically escapes special characters
    filterTypeSelect.appendChild(option);
  });



  // Get unique months
  const parseDate = d3.timeParse("%Y-%m-%d");
  const formatMonth = d3.timeFormat("%Y-%m");
  const months = Array.from(new Set(expenses.map(d => formatMonth(new Date(d.date)))));
  months.sort(); // chronological order
  filterMonthSelect.innerHTML = ''; // Clear previous options

  months.forEach(m => {
    const option = document.createElement('option');
    option.value = m;
    option.textContent = m;
    filterMonthSelect.appendChild(option);
  });


  // Set current month as selected by default
  const currentMonth = d3.timeFormat("%Y-%m")(new Date());
  filterMonthSelect.value = months.includes(currentMonth) ? currentMonth : months[0];
}

filterTypeSelect.addEventListener('change', () => {
  drawTrendChart(filterTypeSelect.value, filterMonthSelect.value);
});
filterMonthSelect.addEventListener('change', () => {
  drawTrendChart(filterTypeSelect.value, filterMonthSelect.value);
});

typeField.addEventListener('change', () => {
  commentBox.style.display = typeField.value === 'Miscellaneous' ? 'block' : 'none';
});

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const date = document.getElementById('date').value;
  const type = typeField.value;
  const amount = parseFloat(document.getElementById('amount').value);
  const comment = type === 'Miscellaneous' ? document.getElementById('comment').value : '';
  const newExpense = { date, type, amount, comment };
  addExpense(newExpense);
  form.reset();
  commentBox.style.display = 'none';
});

function renderExpenseTable() {
  expenseTableBody.innerHTML = '';

  expenses.forEach(expense => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
  <td>${expense.date}</td>
  <td>${expense.type}</td>
  <td>₹${Number(expense.amount).toFixed(2)}</td>
  <td>${expense.comment || '-'}</td>
  <td><button class="remove-btn" data-index="${expense.index}">Remove</button></td>
`;
    expenseTableBody.appendChild(tr);
  });

  // Add event listeners to all remove buttons
  expenseTableBody.querySelectorAll('.remove-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const index = parseInt(e.target.dataset.index);
      removeExpense(index);
    });
  });
}

function drawMonthlyBarChart(expenses) {
  const expensesParsed = expenses.map(d => ({ ...d, date: new Date(d.date) }));

  const year = new Date().getFullYear();
  const allMonths = d3.timeMonths(new Date(year, 0, 1), new Date(year + 1, 0, 1))
    .map(d => d3.timeFormat("%Y-%m")(d));

  const types = Array.from(new Set(expenses.map(d => d.type)));


  const nested = d3.rollup(
    expensesParsed,
    v => d3.rollup(v, vv => d3.sum(vv, d => d.amount), d => d.type),
    d => d3.timeFormat("%Y-%m")(d.date)
  );

  const data = allMonths.map(month => {
    const typeData = nested.get(month) || new Map();
    const filled = { month };
    types.forEach(type => {
      filled[type] = typeData.get(type) || 0;
    });
    return filled;
  });


  const stack = d3.stack().keys(types);
  const stackedData = stack(data);

  const svg = d3.select("#monthlyChart")
    .html("")
    .append("svg")
    .attr("viewBox", `0 0 900 450`)
    .attr("preserveAspectRatio", "xMidYMid meet");

  const width = 900;
  const height = 450;
  const margin = { top: 40, right: 150, bottom: 60, left: 60 };

  const x = d3.scaleBand()
    .domain(allMonths)
    .range([margin.left, width - margin.right - 100])
    .padding(0.1);

  const y = d3.scaleLinear()
    .domain([0, d3.max(data, d => d3.sum(types, type => d[type]))])
    .nice()
    .range([height - margin.bottom, margin.top]);

  const color = d3.scaleOrdinal(d3.schemeCategory10).domain(types);

  // Tooltip
  const tooltip = d3.select("#monthlyChart")
    .append("div")
    .style("position", "absolute")
    .style("padding", "6px 10px")
    .style("background", "#fff")
    .style("border", "1px solid #ccc")
    .style("border-radius", "4px")
    .style("font-size", "12px")
    .style("box-shadow", "0px 2px 4px rgba(0,0,0,0.15)")
    .style("pointer-events", "none")
    .style("opacity", 0);

  // Axes
  svg.append("g")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x).tickFormat(d => d3.timeFormat("%b")(d3.timeParse("%Y-%m")(d))))
    .selectAll("text")
    .attr("transform", "rotate(-40)")
    .style("text-anchor", "end");

  svg.append("g")
    .attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(y));

  // Draw stacked bars
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
    .on("mouseover", function(event, d) {
      tooltip.transition().duration(200).style("opacity", 0.9);
      tooltip.html(`<strong>${d.key}</strong><br/>${d.data.month}<br/>₹${(d[1] - d[0]).toFixed(2)}`)
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY - 28) + "px");
      d3.select(this).attr("fill", d3.rgb(color(d.key)).darker(1.2));
    })
    .on("mousemove", function(event) {
      tooltip.style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY - 28) + "px");
    })
    .on("mouseout", function(event, d) {
      tooltip.transition().duration(300).style("opacity", 0);
      d3.select(this).attr("fill", color(d.key));
    });

  // Legend
  const legend = svg.append("g")
    .attr("transform", `translate(${width - margin.right + 10},${margin.top})`);

  types.forEach((type, i) => {
    const row = legend.append("g")
      .attr("transform", `translate(0,${i * 20})`);

    row.append("rect")
      .attr("width", 14)
      .attr("height", 14)
      .attr("fill", color(type));

    row.append("text")
      .attr("x", 20)
      .attr("y", 12)
      .style("font-size", "12px")
      .text(type);
  });
}

function drawTrendChart(selectedType, selectedMonth) {
  d3.select("#trendChart").html("");

  const parseDate = d3.timeParse("%Y-%m-%d");
  // const formatDate = d3.timeFormat("%Y-%m-%d");
  const expensesParsed = expenses.map(d => ({ ...d, date: new Date(d.date) }));

  const trendData = expensesParsed.filter(d =>
    d3.timeFormat("%Y-%m")(d.date) === selectedMonth && d.type === selectedType
  );



  // Group expenses by day for tooltip
  const expensesByDay = d3.group(trendData, d => d3.timeFormat("%d")(d.date));

  const dailyTotal = Array.from(expensesByDay, ([day, entries]) => ({
    day: +day,
    total: d3.sum(entries, d => d.amount),
    details: entries
  })).sort((a, b) => a.day - b.day);
  const svg2 = d3.select("#trendChart")
    .append("svg")
    .attr("viewBox", `0 0 800 400`)
    .attr("preserveAspectRatio", "xMidYMid meet");

  const width = 800;
  const height = 400;
  const margin = { top: 30, right: 30, bottom: 40, left: 60 };

  const x2 = d3.scaleLinear()
    .domain([1, 31])
    .range([margin.left, width - margin.right]);

  const y2 = d3.scaleLinear()
    .domain([0, d3.max(dailyTotal, d => d.total) || 1])
    .nice()
    .range([height - margin.bottom, margin.top]);

  svg2.append("g")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x2).ticks(31));

  svg2.append("g")
    .attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(y2));

  // Line
  svg2.append("path")
    .datum(dailyTotal)
    .attr("fill", "none")
    .attr("stroke", "#2c3e50")
    .attr("stroke-width", 2)
    .attr("d", d3.line()
      .x(d => x2(d.day))
      .y(d => y2(d.total)));

  // Tooltip div
  const tooltip = d3.select("body").append("div")
    .attr("class", "tooltip")
    .style("position", "absolute")
    .style("background", "#fff")
    .style("border", "1px solid #ccc")
    .style("padding", "10px")
    .style("border-radius", "6px")
    .style("pointer-events", "none")
    .style("font-size", "12px")
    .style("box-shadow", "0px 0px 10px rgba(0,0,0,0.1)")
    .style("display", "none");

  // Circles + Hover Tooltip
  svg2.selectAll("circle")
    .data(dailyTotal)
    .enter()
    .append("circle")
    .attr("cx", d => x2(d.day))
    .attr("cy", d => y2(d.total))
    .attr("r", 4)
    .attr("fill", "#e74c3c")
    .attr("stroke", "#fff")
    .attr("stroke-width", 1)
    .on("mouseover", function(event, d) {
      const html = `<strong>Day ${d.day}</strong><br>` +
        d.details.map(item => `${item.type || "Unnamed"}: ₹${item.amount}`).join("<br>");
      tooltip.html(html)
        .style("display", "block")
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY - 30) + "px");
    })
    .on("mousemove", function(event) {
      tooltip.style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY - 30) + "px");
    })
    .on("mouseout", function() {
      tooltip.style("display", "none");
    });
}


function removeExpense(index) {
  // Remove item at index
  expenses.splice(index, 1);
  // Update localStorage
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(expenses));
  // Update UI
  renderExpenseTable();
  updateCharts();  // Call your chart update function here
  populateFilters(); // Update filters in case types or months changed
}

function updateCharts() {
  drawTrendChart(filterTypeSelect.value, filterMonthSelect.value); // Update trend chart
  drawMonthlyBarChart(expenses);
}


// Initial render
// drawMonthlyBarChart(expenses);
renderExpenseTable();
populateFilters();
updateCharts();
// drawTrendChart(filterTypeSelect.value, filterMonthSelect.value);
