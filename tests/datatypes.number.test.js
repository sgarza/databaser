'use strict';

const { datatypes, model } = require( '../index.js' );

describe( 'datatypes.number', () => {
	it( 'should have expected implementation', () => {
		expect( typeof datatypes.number ).toEqual( 'function' );
		expect( datatypes.number() ).toMatchObject( {
			datatype: 'number',
			options: expect.objectContaining( {
				null: expect.any( Boolean ),
				unique: expect.any( Boolean ),
				range: expect.objectContaining( {
					min: undefined,
					max: undefined
				} ),
				initial: undefined,
				validate: undefined
			} ),
			initial: expect.any( Function ),
			validate: expect.any( Function )
		} );
	} );

	it( 'should not allow non number types', () => {
		const Validation = model( {
			name: 'not_a_number',
			schema: {
				val: datatypes.number()
			}
		} );

		const good = Validation.create( {
			val: 1
		} );

		const bad = Validation.create( {
			val: 'foo'
		} );

		expect( Validation.validate( good ) ).toEqual( [] );
		expect( Validation.validate( bad ) ).toEqual( [ {
			field: 'val',
			error: 'invalid type'
		} ] );
	} );

	it( 'should allow custom validation', () => {
		const Validation = model( {
			name: 'validation',
			schema: {
				val: datatypes.number( {
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

		expect( Validation.validate( good ) ).toEqual( [] );
		expect( Validation.validate( bad ) ).toEqual( [ {
			field: 'val',
			error: 'not 1'
		} ] );
	} );
} );