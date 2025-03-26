import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from "typeorm";

/**
 * Миграция для добавления таблицы истории транзакций
 */
export class AddTransactionHistory1747193652000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Создаем таблицу истории транзакций
        await queryRunner.createTable(new Table({
            name: "transaction_history",
            columns: [
                {
                    name: "id",
                    type: "varchar",
                    isPrimary: true,
                    isGenerated: true,
                    generationStrategy: "uuid"
                },
                {
                    name: "transactionHash",
                    type: "varchar",
                    length: "64"
                },
                {
                    name: "previousStatus",
                    type: "varchar",
                    length: "20",
                    isNullable: true
                },
                {
                    name: "newStatus",
                    type: "varchar",
                    length: "20"
                },
                {
                    name: "action",
                    type: "varchar",
                    length: "50"
                },
                {
                    name: "data",
                    type: "json",
                    isNullable: true
                },
                {
                    name: "message",
                    type: "text",
                    isNullable: true
                },
                {
                    name: "createdAt",
                    type: "timestamp",
                    default: "CURRENT_TIMESTAMP"
                }
            ]
        }), true);

        // Создаем индекс на transactionHash для быстрого поиска
        await queryRunner.createIndex("transaction_history", new TableIndex({
            name: "IDX_TRANSACTION_HISTORY_HASH",
            columnNames: ["transactionHash"]
        }));

        // Создаем внешний ключ для связи с таблицей transactions
        await queryRunner.createForeignKey("transaction_history", new TableForeignKey({
            name: "FK_TRANSACTION_HISTORY_TRANSACTION",
            columnNames: ["transactionHash"],
            referencedTableName: "transactions",
            referencedColumnNames: ["hash"],
            onDelete: "CASCADE"
        }));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Удаляем внешний ключ
        await queryRunner.dropForeignKey("transaction_history", "FK_TRANSACTION_HISTORY_TRANSACTION");
        
        // Удаляем индекс
        await queryRunner.dropIndex("transaction_history", "IDX_TRANSACTION_HISTORY_HASH");
        
        // Удаляем таблицу
        await queryRunner.dropTable("transaction_history");
    }
} 