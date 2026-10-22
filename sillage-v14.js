// Presentation only. Reuse every existing control; never compute or persist finances here.
export function initialize(runtime) {
  document.body.classList.add('sillage-v14');
  const equation = document.getElementById('v13-equation');
  if (equation && !document.getElementById('v14-calculation')) {
    const detail = document.createElement('details');
    detail.id = 'v14-calculation';
    detail.className = 'v14-calculation';
    const summary = document.createElement('summary');
    summary.textContent = 'Détail du disponible';
    equation.before(detail);
    detail.append(summary, equation);
  }
  const scope = document.querySelector('.v70-scope-note');
  const lead = document.querySelector('#v80-hero .v80-hero-body > div:first-child');
  if (scope && lead) lead.append(scope);
  // Short labels describe the content instead of adding a second marketing headline.
  for (const [selector, text] of [
    ['#v80-hero .v80-hero-body > div:first-child > h2', 'Disponible maintenant'],
    ['.v13-chart .v13-panel-head h2', 'Évolution du disponible'],
    ['.v13-next .v13-panel-head h2', 'À venir'],
    ['.v13-envelope-preview .v13-panel-head h2', 'Enveloppes'],
    ['.v13-recent .v13-panel-head h2', 'Dernières dépenses'],
    ['#v4-forecast .v4-chart-heading h3', 'Solde et disponible'],
    ['#v4-forecast .v4-lower-grid .v4-card:first-child h3', 'Prochaines opérations'],
    ['#v4-forecast .v4-lower-grid .v4-card:nth-child(2) h3', 'Prévu et réel'],
  ]) {
    const element = document.querySelector(selector);
    if (element) element.textContent = text;
  }
}
