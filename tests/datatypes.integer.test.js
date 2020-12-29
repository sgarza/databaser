'use strict';

const assert = require( 'assert' );
const { datatypes, model } = require( '../index.js' );

module.exports = async ( plaintest ) => {
	const group = plaintest.group( 'datatypes.integer' );

	group.test( 'should have expected implementation', () => {
		assert.strictEqual( typeof datatypes.integer, 'function' );

		const obj = datatypes.integer();

		assert.strictEqual( obj?.datatype, 'integer' );
		assert.deepStrictEqual( obj?.options, {
			nullable: true,
			unique: false,
			range: {
				min: undefined,
				max: undefined
			},
			initial: undefined,
			validate: undefined,
			example: 11
		} );

		assert.strictEqual( typeof obj?.initial, 'function' );
		assert.strictEqual( typeof obj?.validate, 'function' );
	} );

	group.test( 'should not allow non number types', () => {
		const Validation = model( {
			name: 'not_a_number',
			schema: {
				val: datatypes.integer()
			}
		} );

		const good = Validation.create( {
			val: 1
		} );

		const bad = Validation.create( {
			val: 'foo'
		} );

		assert.deepStrictEqual( Validation.validate( good ), [] );
		assert.deepStrictEqual( Validation.validate( bad ), [ {
			field: 'val',
			error: 'invalid type'
		} ] );
	} );

	group.test( 'should not allow floating point numbers', () => {
		const Validation = model( {
			name: 'not_floating_point',
			schema: {
				val: datatypes.integer()
			}
		} );

		const good = Validation.create( {
			val: 1
		} );

		const bad = Validation.create( {
			val: 1.1
		} );

		assert.deepStrictEqual( Validation.validate( good ), [] );
		assert.deepStrictEqual( Validation.validate( bad ), [ {
			field: 'val',
			error: 'invalid value'
		} ] );
	} );

	group.test( 'should allow custom validation', () => {
		const Validation = model( {
			name: 'validation',
			schema: {
				val: datatypes.integer( {
					validate: ( value ) => {
						if ( value !== 1 ) {
							return 'not 1';
						}
					}
				} )
			}
		} );

		const good = Validation.create( {
			val: 1
		} );

		const bad = Validation.create( {
			val: 2
		} );

		assert.deepStrictEqual( Validation.validate( good ), [] );
		assert.deepStrictEqual( Validation.validate( bad ), [ {
			field: 'val',
			error: 'not 1'
		} ] );
	} );
};