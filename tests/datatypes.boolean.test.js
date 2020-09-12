'use strict';

const { datatypes, model } = require( '../index.js' );

describe( 'datatypes.boolean', () => {
	it( 'should have expected implementation', () => {
		expect( typeof datatypes.boolean ).toEqual( 'function' );
		expect( datatypes.boolean() ).toMatchObject( {
			datatype: 'boolean',
			options: expect.objectContaining( {
				null: expect.any( Boolean ),
				initial: undefined,
				validate: undefined
			} ),
			initial: expect.any( Function ),
			validate: expect.any( Function )
		} );
	} );

	it( 'should validate the boolean', () => {
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

		expect( Boolean.validate( good ) ).toEqual( [] );
		expect( Boolean.validate( bad ) ).toEqual( [ {
			field: 'bool',
			error: 'invalid value'
		} ] );
	} );

	it( 'should allow additional custom validation', () => {
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

		expect( Boolean.validate( good ) ).toEqual( [] );
		expect( Boolean.validate( bad ) ).toEqual( [ {
			field: 'bool',
			error: 'not true'
		} ] );
	} );
} );