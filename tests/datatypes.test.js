'use strict';

const { datatypes } = require( '../index.js' );

describe( 'datatypes', () => {
    it( 'email', () => {
        expect( typeof datatypes.email ).toEqual( 'function' );
        expect( datatypes.email() ).toMatchObject( {
            datatype: 'email',
            options: expect.objectContaining( {
                null: expect.any( Boolean ),
                length: expect.objectContaining( {
                    min: expect.any( Number ),
                    max: undefined
                } ),
                unique: expect.any( Boolean ),
                initial: undefined
            } ),
            initial: expect.any( Function ),
            validate: expect.any( Function )
        } );
    } );

    it( 'integer', () => {
        expect( typeof datatypes.integer ).toEqual( 'function' );
        expect( datatypes.integer() ).toMatchObject( {
            datatype: 'integer',
            options: expect.objectContaining( {
                null: expect.any( Boolean ),
                range: expect.objectContaining( {
                    min: undefined,
                    max: undefined
                } ),
                unique: expect.any( Boolean ),
                initial: undefined
            } ),
            initial: expect.any( Function ),
            validate: expect.any( Function )
        } );
    } );

    it( 'ISODate', () => {
        expect( typeof datatypes.ISODate ).toEqual( 'function' );
        expect( datatypes.ISODate() ).toMatchObject( {
            datatype: 'ISODate',
            options: expect.objectContaining( {
                null: expect.any( Boolean ),
                initial: undefined
            } ),
            initial: expect.any( Function ),
            validate: expect.any( Function )
        } );
    } );

    it( 'JSON', () => {
        expect( typeof datatypes.JSON ).toEqual( 'function' );
        expect( datatypes.JSON() ).toMatchObject( {
            datatype: 'JSON',
            options: expect.objectContaining( {
                null: expect.any( Boolean ),
                initial: undefined
            } ),
            initial: expect.any( Function ),
            validate: expect.any( Function )
        } );
    } );

    it( 'phone', () => {
        expect( typeof datatypes.phone ).toEqual( 'function' );
        expect( datatypes.phone() ).toMatchObject( {
            datatype: 'phone',
            options: expect.objectContaining( {
                null: expect.any( Boolean ),
                length: expect.objectContaining( {
                    min: undefined,
                    max: expect.any( Number )
                } ),
                unique: expect.any( Boolean ),
                initial: undefined
            } ),
            initial: expect.any( Function ),
            validate: expect.any( Function )
        } );
    } );

    it( 'string', () => {
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

    it( 'UUID', () => {
        expect( typeof datatypes.UUID ).toEqual( 'function' );
        expect( datatypes.UUID() ).toMatchObject( {
            datatype: 'UUID',
            options: expect.objectContaining( {
                null: expect.any( Boolean ),
                unique: expect.any( Boolean ),
                initial: undefined
            } ),
            initial: expect.any( Function ),
            validate: expect.any( Function )
        } );
    } );
} );