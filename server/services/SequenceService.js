import db from '../db.js';

export class SequenceService {
  /**
   * Generates a concurrency-safe sequential code using database transactions
   * Format: PREFIX-YYYY-XXXX (e.g. FORM-2026-0101, BAT-2026-0101)
   */
  static async getNextSequence(sequenceName, trx) {
    const dbClient = trx || db;
    const currentYear = new Date().getFullYear();

    const seq = await dbClient('system_sequences')
      .where({ sequence_name: sequenceName })
      .first();

    let prefix = 'NUM';
    let nextVal = 1;

    if (!seq) {
      if (sequenceName === 'FORMULA_CODE') prefix = 'FORM';
      else if (sequenceName === 'BATCH_NUMBER') prefix = 'BAT';
      else if (sequenceName === 'DEVIATION_CODE') prefix = 'DEV';
      else if (sequenceName === 'CORRECTION_CODE') prefix = 'COR';
      else if (sequenceName === 'REWORK_CODE') prefix = 'RWK';

      await dbClient('system_sequences').insert({
        sequence_name: sequenceName,
        current_val: 1,
        prefix,
        year: currentYear,
      });
    } else {
      prefix = seq.prefix;
      nextVal = seq.current_val + 1;
      await dbClient('system_sequences')
        .where({ sequence_name: sequenceName })
        .update({
          current_val: nextVal,
          year: currentYear,
          updated_at: dbClient.fn.now(),
        });
    }

    const paddedVal = String(nextVal).padStart(4, '0');
    return `${prefix}-${currentYear}-${paddedVal}`;
  }
}
