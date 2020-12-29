'use strict';

const assert = require( 'assert' );
const { datatypes, model } = require( '../index.js' );

module.exports = async ( plaintest ) => {
	const group = plaintest.group( 'datatypes.boolean' );

	group.test( 'should have expected implementation', () => {
		assert.strictEqual( typeof datatypes.boolean, 'function' );

		const bool = datatypes.boolean();
		assert.strictEqual( bool?.datatype, 'boolean' );
		assert.deepStrictEqual( bool?.options, {
			nullable: true,
			initial: undefined,
			validate: undefined,
			example: true
		} );
		assert.strictEqual( typeof bool?.initial, 'function' );
		assert.strictEqual( typeof bool?.validate, 'function' );
	} );

	group.test( 'should validate the boolean', () => {
		const Boolean = model( {
			name: 'boolean',
			schema: {
				bool: datatypes.boolean()
			}
		} );

		const good = Boolean.create( {
			bool: true
		} );

		const bad = Boolean.create( {
			bool: 'invalid'
		} );

		assert.deepStrictEqual( Boolean.validate( good ), [] );
		assert.deepStrictEqual( Boolean.validate( bad ), [ {
			field: 'bool',
			error: 'invalid value'
		} ] );
	} );

	group.test( 'should allow additional custom validation', () => {
		const Boolean = model( {
			name: 'boolean',
			schema: {
				bool: datatypes.boolean( {
					validate: ( value ) => {
						if ( value !== true ) {
							return 'not true';
						}
					}
				} )
			}
		} );

		const good = Boolean.create( {
			bool: true
		} );

		const bad = Boolean.create( {
			bool: false
		} );

		assert.deepStrictEqual( Boolean.validate( good ), [] );
		assert.deepStrictEqual( Boolean.validate( bad ), [ {
			field: 'bool',
			error: 'not true'
		} ] );
	} );
};