'use strict';

const assert = require( 'assert' );
const { datatypes, model } = require( '../index.js' );

module.exports = async ( plaintest ) => {
	const group = plaintest.group( 'datatypes.enum' );

	group.test( 'should have expected implementation', () => {
		assert.strictEqual( typeof datatypes.enum, 'function' );

		const obj = datatypes.enum();

		assert.strictEqual( obj?.datatype, 'enum' );
		assert.deepStrictEqual( obj?.options, {
			nullable: true,
			initial: undefined,
			validate: undefined,
			values: [],
			example: undefined
		} );
		assert.strictEqual( typeof obj?.initial, 'function' );
		assert.strictEqual( typeof obj?.validate, 'function' );
	} );

	group.test( 'should validate that values are members of the enum', () => {
		const Enum = model( {
			name: 'enum',
			schema: {
				enum: datatypes.enum( {
					values: [
						'foo',
						'bar',
						'baz'
					]
				} )
			}
		} );

		const good = Enum.create( {
			enum: 'foo'
		} );

		const bad = Enum.create( {
			enum: 'invalid'
		} );

		assert.deepStrictEqual( Enum.validate( good ), [] );
		assert.deepStrictEqual( Enum.validate( bad ), [ {
			field: 'enum',
			error: 'invalid value'
		} ] );
	} );

	group.test( 'should allow additional custom validation', () => {
		const Enum = model( {
			name: 'enum',
			schema: {
				enum: datatypes.enum( {
					values: [
						'foo',
						'bar',
						'baz'
					],
					validate: ( value ) => {
						if ( value !== 'foo' ) {
							return 'not foo';
						}
					}
				} )
			}
		} );

		const good = Enum.create( {
			enum: 'foo'
		} );

		const bad = Enum.create( {
			enum: 'bar'
		} );

		assert.deepStrictEqual( Enum.validate( good ), [] );
		assert.deepStrictEqual( Enum.validate( bad ), [ {
			field: 'enum',
			error: 'not foo'
		} ] );
	} );
};