import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

/**
 * Миграция для создания таблицы транзакций
 */
export class CreateTransactionsTable1712269321023 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'transactions',
        columns: [
          {
            name: 'hash',
            type: 'varchar',
            length: '64',
            isPrimary: true,
          },
          {
            name: 'amount',
            type: 'decimal',
            precision: 15,
            scale: 9,
            isNullable: true,
          },
          {
            name: 'senderAddress',
            type: 'varchar',
            length: '64',
            isNullable: true,
          },
          {
            name: 'comment',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'username',
            type: 'varchar',
            length: '32',
            isNullable: true,
          },
          {
            name: 'starsAmount',
            type: 'integer',
            isNullable: true,
          },
          {
            name: 'fragmentTransactionHash',
            type: 'varchar',
            length: '64',
            isNullable: true,
          },
          {
            name: 'status',
            type: 'varchar',
            length: '20',
            default: "'processed'",
          },
          {
            name: 'errorMessage',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Создаем индексы для ускорения запросов
    await queryRunner.createIndex(
      'transactions',
      new TableIndex({
        name: 'IDX_TRANSACTIONS_STATUS',
        columnNames: ['status'],
      }),
    );

    await queryRunner.createIndex(
      'transactions',
      new TableIndex({
        name: 'IDX_TRANSACTIONS_USERNAME',
        columnNames: ['username'],
      }),
    );

    await queryRunner.createIndex(
      'transactions',
      new TableIndex({
        name: 'IDX_TRANSACTIONS_SENDER',
        columnNames: ['senderAddress'],
      }),
    );

    await queryRunner.createIndex(
      'transactions',
      new TableIndex({
        name: 'IDX_TRANSACTIONS_CREATED_AT',
        columnNames: ['createdAt'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Удаляем индексы
    await queryRunner.dropIndex('transactions', 'IDX_TRANSACTIONS_STATUS');
    await queryRunner.dropIndex('transactions', 'IDX_TRANSACTIONS_USERNAME');
    await queryRunner.dropIndex('transactions', 'IDX_TRANSACTIONS_SENDER');
    await queryRunner.dropIndex('transactions', 'IDX_TRANSACTIONS_CREATED_AT');

    // Удаляем таблицу
    await queryRunner.dropTable('transactions');
  }
} 