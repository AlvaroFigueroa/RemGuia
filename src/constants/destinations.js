export const DESTINATIONS = [
  {
    value: 'Santiago',
    label: 'Santiago',
    subDestinations: ['Centro', 'Independencia', 'Maipú', 'Puente Alto']
  },
  {
    value: 'Concepción',
    label: 'Concepción',
    subDestinations: ['Los Ángeles', 'Coronel', 'Talcahuano']
  },
  {
    value: 'Temuco',
    label: 'Temuco',
    subDestinations: ['Padre Las Casas', 'Victoria']
  },
  {
    value: 'Valdivia',
    label: 'Valdivia',
    subDestinations: ['Paillaco', 'La Unión']
  },
  {
    value: 'Puerto Montt',
    label: 'Puerto Montt',
    subDestinations: ['Osorno', 'Puerto Varas']
  }
];

export const LOCATIONS = [
  { value: 'Bodega Central', label: 'Bodega Central' },
  { value: 'Planta Norte', label: 'Planta Norte' },
  { value: 'Planta Sur', label: 'Planta Sur' },
  { value: 'Centro de Distribución', label: 'Centro de Distribución' }
];

export const getSubDestinations = (destinationValue) =>
  DESTINATIONS.find((dest) => dest.value === destinationValue)?.subDestinations || [];
