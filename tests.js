test('sanity', function ()
{
    ok(2 + 2 != 5, 'It\'s not 1984')
    ok(typeof dmf != "undefined", 'dmf is defined')
})

module('events')

var Counter = function ()
{
    this.i = 0
    this.inc = function () { this.i++ }.bind(this)
}

test('Simple events', function ()
{
    var counter = new Counter()
    ok(counter.i == 0, 'Counter is zero')
    
    var hub = new dmf.EventHub()
    hub.on('foo', counter.inc)
    hub.fire('foo')
    equal(counter.i, 1, "Event fired once")
    
    hub.fire('foo')
    hub.fire('foo')
    equal(counter.i, 3, "Event fired twice")
    
    hub.off('foo', counter.inc)
    hub.fire('foo')
    equal(counter.i, 3, "Event fired but did not call unregistered listener")
    
    var counter2 = new Counter()
    
    hub.on('bar', counter.inc)
    hub.on('bar', counter2.inc)
    hub.fire('bar')
    ok(counter.i == 4 && counter2.i == 1, "Event fired and called 2 listeners once each")
    
    var result = 0
    hub.on('do-addition', function (a,b) { result = a+b })
    hub.fire('do-addition', 5, 23)
    equal(result, 28, 'Event passed arguments to callback')
})

test('Multiple event registration', function ()
{
    var counter = new Counter(),
        hub = new dmf.EventHub()
    
    hub.on('foo bar baz', counter.inc)
    hub.fire('foo')
    hub.fire('bar')
    hub.fire('baz')
    equal(counter.i, 3, "Called listener once for each registered event")
    
    hub.off('foo baz', counter.inc)
    hub.fire('foo')
    hub.fire('baz')
    equal(counter.i, 3, "Didn't call unregistered listeners")
    
    hub.fire('bar')
    equal(counter.i, 4, "Called listener that was still registered")
})

test('One time events', function ()
{
    var counter1 = new Counter(),
        counter2 = new Counter(),
        hub = new dmf.EventHub()
    
    hub.on('you-only-live', counter1.inc)
    hub.one('you-only-live', counter2.inc)
    
    hub.fire('you-only-live')
    hub.fire('you-only-live')
    hub.fire('you-only-live')
    
    equal(counter1.i, 3, "Called normal listener 3 times")
    equal(counter2.i, 1, "Called one-time listener once")
    
})

test('Late events', function ()
{
    var counter = new Counter(),
        hub = new dmf.EventHub()
    
    hub.fire('white-rabbit')
    equal(counter.i, 0, "Did not call unregistered listener")
    
    hub.late('white-rabbit', counter.inc)
    equal(counter.i, 1, "Called late-bound listener")
    
    hub.fire('white-rabbit')
    equal(counter.i, 2, "Called late-bound listener like a normal listener for subsequent events")
})

test('Catch-all listener', function ()
{
    var counter = new Counter(),
        hub = new dmf.EventHub()
        
    hub.all(counter.inc)
    hub.fire('there')
    hub.fire('that')
    hub.fire('is')
    hub.fire('better')
    equal(counter.i, 4, "Catch-all listener was called for 4 unregistered events")
})


module('models')

test('Simple model', function ()
{
    var Pony = dmf.model.create(
    {
        name: null,
        color: null,
        cutie_mark: null
    })
    
    deepEqual(Object.keys(Pony.schema), ['name', 'color', 'cutie_mark'], "Model has all fields defined in schema")
    
    var twilight = new Pony()
    twilight.name = 'Twilight Sparkle'
    equal(twilight.get('name'), 'Twilight Sparkle', 'Setting and getting properties works')
    
    var model = null, field_name = null
    twilight.on('change', function (m, n)
    {
        model = m
        field_name = n
    })
    twilight.color = 'purple'
    equal(model, twilight, 'Model-level notifications work')
    equal(field_name, 'color', 'Model-level notifications pass the correct field name')
    
    var counter = new Counter()
    twilight.on('change.cutie_mark', counter.inc)
    twilight.cutie_mark = 'star'
    equal(counter.i, 1, "Property-level notifications work")
    
    twilight.color = 'super friendly purple'
    equal(counter.i, 1, "Property-level notifications only fired for registered property")
})

test('Property validation', function ()
{
    var is_number = function (value) { return value.constructor == Number },
        Spell = dmf.model.create(
            {
                id: null,
                name: null,
                strength: is_number,
                distance: is_number,
            }
        )
    
    var spell = new Spell(),
        model = null,
        field_name = null
        
    spell.on('valid', function (m, n)
    {
        model = m
        field_name = n
    })
    spell.name = 'time travel'
    equal(model, spell, "Valid notifications work")
    equal(field_name, 'name', "Valid notifications pass correct field name")
    
    model
    
    spell.on('valid.name', function (m)
    {
        model = m
    })
    spell.name = 'time travel'
    equal(model, spell, "Property-level valid notifications work")
    
    var counter = new Counter()
    spell.on('valid.name', counter.inc)
    spell.strength = 0.5
    equal(counter.i, 0, "Property-level valid notifications only fire for registered <properties></properties>")
    
    model = field_name = null
    
    spell.on('invalid', function (m, n)
    {
        model = m
        field_name = n
    })
    spell.strength = 'you no spell good'
    equal(model, spell, "Invalid notifications work")
    equal(field_name, 'strength', "Invalid notifications pass correct field name")
    
    counter.i = 0
    spell.on('invalid.strength', counter.inc)
    spell.strength = 'you no spell good'
    equal(counter.i, 1, "Property-level invalid notification works")
    
    spell.distance = 'you no far go'
    equal(counter.i, 1, "Property-level invalid notifications only fire for registered properties")
})

test('Local model storage', function ()
{
    localStorage.clear()
    
    var store = new dmf.store.LocalStore()
        Pony = dmf.model.create(
            {
                name: null,
                color: null,
                cutie_mark: null
            },
            {
                name: 'Pony',
                primary_key: 'name'
            }
        )
    
    store.get(Pony, {}, function (ponies, error)
    {
        equal(ponies.length, 0, "Local storage starts out empty")
    })
    
    var ponies = [
        {
            name: 'Twilight Sparkle',
            color: 'purple',
            cutie_mark: 'star'
        },
        {
            name: 'Pinkie Pie',
            color: 'pink',
            cutie_mark: 'balloons'
        },
        {
            name: 'Rarity',
            color: 'white',
            cutie_mark: 'diamonds'
        },
        {
            name: 'Applejack',
            color: 'orange',
            cutie_mark: 'apples'
        },
        {
            name: 'Fluttershy',
            color: 'yellow',
            cutie_mark: 'butterflies'
        },
        {
            name: 'Rainbow Dash',
            color: 'blue',
            cutie_mark: 'rainbow bolt'
        }
    ].map(function (fields) { var p = new Pony(fields); store.save(p) })
    
    store.get(Pony, {}, function (all_ponies)
    {
        equal(all_ponies.length, ponies.length, "Can get all the saved instances")
    })
    
    store.get_by_id(Pony, "Fahrvergnügen", {}, function (pony)
    {
        equal(pony, null, "Nothing returned for nonexistent key")
    })
    
    var rainbow = null
    store.get_by_id(Pony, "Rainbow Dash", {}, function (pony)
    {
        equal(pony.name, "Rainbow Dash", "Can retrieve instance by primary key")
        rainbow = pony
    })
    
    equal(rainbow.color, "blue", "Fields came through serialization OK")
    
    rainbow.color = 'light blue'
    store.save(rainbow, function ()
    {
        store.get_by_id(Pony, "Rainbow Dash", {}, function (pony)
        {
            equal(pony.color, "light blue", "Overwrote existing model")
        })
    })
})

asyncTest('Rest model storage', function ()
{
    var store = new dmf.store.RESTStore({
        base_url: 'http://localhost:3002/'
    })
    
    store._request('GET', 'clear')
    
    var Pony = dmf.model.create(
        {
            name: null,
            color: null,
            cutie_mark: null
        },
        {
            name: 'Pony',
            plural_name: 'Ponies',
            primary_key: 'name'
        }
    )
    
    var i=0,
        next = function ()
        {
            if (i == test.length - 1)
            {
                start()
            }
            else
            {
                tests[i]()
                i++
            }
        },
        tests = [
            function ()
            {
                var pony = new Pony({
                    name: 'Twilight Sparkle',
                    color: 'purple',
                    cutie_mark: 'star'
                })
                
                store.save(pony, {}, function (pony, error)
                {
                    equal(pony.name, "Twilight Sparkle", "Saved an instance")
                    next()
                })
            },
            function ()
            {
                store.get_by_id(Pony, 'Twilight Sparkle', {}, function (pony, error)
                {
                    equal(pony.name, "Twilight Sparkle", "Got an instance by id")
                    next()
                })
            },
            function ()
            {
                var pony = new Pony({
                    name: 'Pinkie Pie',
                    color: 'orange',
                    cutie_mark: 'balloons'
                })
                
                store.save(pony, {}, function ()
                {
                    store.get(Pony, {}, function (ponies)
                    {
                        equal(ponies.length, 2, "Got a list of instances")
                        next()
                    })
                })
            },
            function ()
            {
                store.get_by_id(Pony, 'Pinkie Pie', {}, function (pony)
                {
                    pony.color = 'pink'
                    store.save(pony, {}, function ()
                    {
                        store.get_by_id(Pony, 'Pinkie Pie', {}, function (pony)
                        {
                            equal(pony.color, 'pink', 'Updated instance')
                            next()
                        })
                    })
                })
            },
            function ()
            {
                store.get_by_id(Pony, 'Pinkie Pie', {}, function (pony)
                {
                    store.delete(pony, function ()
                    {
                        store.get_by_id(Pony, 'Pinkie Pie', function (pony, error)
                        {
                            equal(pony, null, "Deleted an instance")
                        })
                    })
                })
            }
        ]
    next()
})

module('application')

test('Create an app', function ()
{
    var app = new dmf.Application()
    
    ok(typeof app.options != 'undefined', "Has options")
    ok(typeof app.models != 'undefined', "Has models")
    ok(typeof app.views != 'undefined', "Has views")
    ok(typeof app.controllers != 'undefined', "Has controllers")
})