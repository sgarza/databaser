'use strict';

const { datatypes, model } = require( '../index.js' );

describe( 'datatypes.string', () => {
	it( 'should have expected implementation', () => {
		expect( typeof datatypes.string ).toEqual( 'function' );
		expect( datatypes.string() ).toMatchObject( {
			datatype: 'string',
			options: expect.objectContaining( {
				null: expect.any( Boolean ),
				length: expect.objectContaining( {
					min: undefined,
					max: undefined
				} ),
				unique: expect.any( Boolean ),
				initial: undefined,
				validate: undefined
			} ),
			initial: expect.any( Function ),
			validate: expect.any( Function )
		} );
	} );

	it( 'should allow custom validation', () => {
		const Validation = model( {
			name: 'validation',
			schema: {
				val: datatypes.string( {
					validate: ( value ) => {
						if ( value !== 'foo' ) {
							return 'not foo';
						}
					}
				} )
			}
		} );

		const good = Validation.create( {
			val: 'foo'
		} );

		const bad = Validation.create( {
			val: 'bar'
		} );

		expect( Validation.validate( good ) ).toEqual( [] );
		expect( Validation.validate( bad ) ).toEqual( [ {
			field: 'val',
			error: 'not foo'
		} ] );
	} );
} );