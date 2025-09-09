export function initTabs(){
  const tabs = Array.from(document.querySelectorAll('.tab'));
  const day  = document.getElementById('dayView');
  const foods= document.getElementById('foodsView');

  const show = (name) => {
    tabs.forEach(t => {
      const active = t.dataset.tab === name;
      t.classList.toggle('active', active);
      t.setAttribute('aria-selected', active ? 'true' : 'false');
      t.setAttribute('tabindex', active ? '0' : '-1');
    });
    day.classList.toggle('hidden', name !== 'day');
    foods.classList.toggle('hidden', name !== 'foods');
  };

  tabs.forEach(t => t.addEventListener('click', () => show(t.dataset.tab)));
  show('day');
}
