import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

/**
 * Миграция для добавления поля outgoingTransactionHash в таблицу transactions
 * Это поле будет хранить хеш исходящей транзакции TON на адрес Fragment
 */
export class AddOutgoingTransactionHash1747191321023 implements MigrationInterface {
    name = 'AddOutgoingTransactionHash1747191321023'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Добавляем новую колонку outgoingTransactionHash
        await queryRunner.addColumn(
            'transactions',
            new TableColumn({
                name: 'outgoingTransactionHash',
                type: 'varchar',
                length: '64',
                isNullable: true,
                comment: 'Хеш исходящей TON транзакции на адрес Fragment'
            })
        );

        console.log('Миграция успешно добавила поле outgoingTransactionHash в таблицу transactions');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Откатываем изменения - удаляем колонку при необходимости
        await queryRunner.dropColumn('transactions', 'outgoingTransactionHash');
        
        console.log('Миграция успешно удалила поле outgoingTransactionHash из таблицы transactions');
    }
} 