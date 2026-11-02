import { calculateB1, calculateB2, calculateB3 } from './domain/indicators/index';

const API_URL = 'http://localhost:3001/api';

async function testKpis() {
  const res = await fetch(`${API_URL}/buyer`);
  const buyers = await res.json();

  console.log('Total de buyers recibidos:', buyers.length);

  const b1 = calculateB1(buyers);
  const b2 = calculateB2(buyers);
  const b3 = calculateB3(buyers);

  console.log('\n====================================');
  console.log('--- RESULTADOS DE INDICADORES REALES ---');
  console.log('B1 (Conversión 14d):', b1.displayValueOverride || `${b1.value?.toFixed(1)}%`, '| Status:', b1.status, '| Detalle:', b1.baseMeasures?.detailText);
  console.log('B2 (Utilizables):   ', b2.displayValueOverride || `${b2.value?.toFixed(1)}%`, '| Status:', b2.status, '| Detalle:', b2.baseMeasures?.detailText);
  console.log('B3 (Costo/Lead):    ', b3.displayValueOverride || `S/ ${b3.value?.toFixed(2)}`, '| Status:', b3.status, '| Detalle:', b3.baseMeasures?.detailText);
  console.log('====================================\n');
}

testKpis().catch(console.error);
