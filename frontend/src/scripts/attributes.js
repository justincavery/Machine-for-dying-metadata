import { fetchStats } from './api.js';

const loadingEl = document.getElementById('loading');
const contentEl = document.getElementById('attributesContent');
const traitsListEl = document.getElementById('traitsList');

async function loadAttributes() {
  try {
    const stats = await fetchStats();

    traitsListEl.innerHTML = '';

    // Sort traits by count
    const sortedTraits = [...stats.traits].sort((a, b) => b.count - a.count);

    for (const trait of sortedTraits) {
      const traitValues = stats.trait_values[trait.trait_type] || [];

      const traitSection = document.createElement('div');
      traitSection.className = 'trait-section';

      const header = document.createElement('h3');
      header.innerHTML = `${trait.trait_type} <span class="count">(${trait.count} NFTs)</span>`;
      traitSection.appendChild(header);

      const valuesGrid = document.createElement('div');
      valuesGrid.className = 'values-grid';

      for (const item of traitValues) {
        const valueLink = document.createElement('a');
        valueLink.className = 'value-item';
        valueLink.href = `/?trait_type=${encodeURIComponent(trait.trait_type)}&trait_value=${encodeURIComponent(item.value)}`;
        valueLink.innerHTML = `
          <span class="value-name">${item.value}</span>
          <span class="value-count">${item.count}</span>
        `;
        valuesGrid.appendChild(valueLink);
      }

      traitSection.appendChild(valuesGrid);
      traitsListEl.appendChild(traitSection);
    }

    loadingEl.style.display = 'none';
    contentEl.style.display = 'block';

  } catch (error) {
    console.error('Failed to load attributes:', error);
    loadingEl.textContent = 'Failed to load attributes. Please refresh the page.';
  }
}

loadAttributes();
